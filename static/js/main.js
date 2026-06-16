document.addEventListener("DOMContentLoaded", () => {
    // --- Application State ---
    let allReleases = []; // Raw releases from API
    let parsedUpdates = []; // Flattened, parsed individual updates
    let activeCategory = "all";
    let searchQuery = "";
    
    // --- DOM Elements ---
    const loadingState = document.getElementById("loading-state");
    const emptyState = document.getElementById("empty-state");
    const timelineContainer = document.getElementById("timeline-container");
    const lastSyncTimeEl = document.getElementById("last-sync-time");
    const refreshBtn = document.getElementById("refresh-btn");
    const syncIcon = document.getElementById("sync-icon");
    const btnSpinner = refreshBtn.querySelector(".btn-spinner");
    const btnContent = refreshBtn.querySelector(".btn-content");
    
    const searchInput = document.getElementById("search-input");
    const clearSearchBtn = document.getElementById("clear-search");
    const categoryFilters = document.getElementById("category-filters");
    const resetFiltersBtn = document.getElementById("reset-filters-btn");
    
    // Stats elements
    const statTotalUpdates = document.getElementById("stat-total-updates");
    const statFeatures = document.getElementById("stat-features");
    const statIssues = document.getElementById("stat-issues");
    const statChanges = document.getElementById("stat-changes");
    
    // Tweet modal elements
    const tweetModal = document.getElementById("tweet-modal");
    const tweetTextarea = document.getElementById("tweet-textarea");
    const charLimitRing = document.getElementById("char-limit-ring");
    const charCountNum = document.getElementById("char-count-num");
    const closeModalBtn = document.getElementById("close-modal-btn");
    const copyTweetBtn = document.getElementById("copy-tweet-btn");
    const postTweetBtn = document.getElementById("post-tweet-btn");
    
    const warningAlert = document.getElementById("warning-alert");
    const warningMessage = document.getElementById("warning-message");

    // --- XML HTML Parser to Individual Updates ---
    function parseEntryContent(contentHtml, entryTitle, entryLink) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(contentHtml, "text/html");
        const children = Array.from(doc.body.children);
        
        const updates = [];
        let currentCategory = null;
        let currentElements = [];
        
        function commitUpdate() {
            if (currentElements.length > 0 || currentCategory) {
                const container = document.createElement("div");
                currentElements.forEach(el => {
                    // Deep clone and modify links to open in a new window
                    const clone = el.cloneNode(true);
                    if (clone.tagName === 'A') {
                        clone.setAttribute('target', '_blank');
                        clone.setAttribute('rel', 'noopener noreferrer');
                    }
                    clone.querySelectorAll('a').forEach(a => {
                        a.setAttribute('target', '_blank');
                        a.setAttribute('rel', 'noopener noreferrer');
                    });
                    container.appendChild(clone);
                });
                
                const category = currentCategory || "Update";
                
                updates.push({
                    id: `${entryLink}#${category}-${updates.length}-${Math.random().toString(36).substr(2, 5)}`,
                    date: entryTitle,
                    link: entryLink,
                    category: category,
                    html: container.innerHTML,
                    text: container.innerText.trim()
                });
            }
            currentCategory = null;
            currentElements = [];
        }
        
        children.forEach(child => {
            if (child.tagName === "H3") {
                commitUpdate();
                currentCategory = child.innerText.trim();
            } else {
                currentElements.push(child);
            }
        });
        
        // Commit final chunk
        commitUpdate();
        
        // Fallback for simple content that doesn't use H3
        if (updates.length === 0 && contentHtml.trim() !== "") {
            // Modify links
            const container = document.createElement("div");
            container.innerHTML = contentHtml;
            container.querySelectorAll('a').forEach(a => {
                a.setAttribute('target', '_blank');
                a.setAttribute('rel', 'noopener noreferrer');
            });

            updates.push({
                id: `${entryLink}#default`,
                date: entryTitle,
                link: entryLink,
                category: "Update",
                html: container.innerHTML,
                text: container.innerText.trim()
            });
        }
        
        return updates;
    }

    // --- API Calls ---
    async function fetchReleases(forceRefresh = false) {
        setLoading(true);
        try {
            const response = await fetch(`/api/releases?refresh=${forceRefresh}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            if (data.success) {
                allReleases = data.releases;
                
                // Set Last Synced time
                if (data.last_fetched) {
                    const date = new Date(data.last_fetched);
                    lastSyncTimeEl.textContent = `Last Synced: ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
                }
                
                // Parse and flatten updates
                parsedUpdates = [];
                allReleases.forEach(release => {
                    const parsed = parseEntryContent(release.content, release.title, release.link);
                    parsedUpdates.push(...parsed);
                });
                
                // Handle warning if cache fallback occurred
                if (data.warning) {
                    showWarning(data.warning);
                } else {
                    hideWarning();
                }
                
                calculateStats();
                renderTimeline();
            } else {
                throw new Error(data.error || "Unknown error fetching feed.");
            }
        } catch (error) {
            console.error("Error loading release notes:", error);
            showWarning(`Failed to fetch updates: ${error.message}. Please try again.`);
            
            // If we have no data, show empty state
            if (parsedUpdates.length === 0) {
                loadingState.classList.add("hidden");
                emptyState.classList.remove("hidden");
            }
        } finally {
            setLoading(false);
        }
    }

    // --- Helper UI Functions ---
    function setLoading(isLoading) {
        if (isLoading) {
            loadingState.classList.remove("hidden");
            timelineContainer.classList.add("hidden");
            emptyState.classList.add("hidden");
            
            // Spin sync icon
            syncIcon.classList.add("spin");
            btnSpinner.classList.remove("hidden");
            btnContent.classList.add("hidden");
            refreshBtn.disabled = true;
        } else {
            loadingState.classList.add("hidden");
            
            syncIcon.classList.remove("spin");
            btnSpinner.classList.add("hidden");
            btnContent.classList.remove("hidden");
            refreshBtn.disabled = false;
        }
    }

    function showWarning(message) {
        warningMessage.textContent = message;
        warningAlert.classList.remove("hidden");
    }

    function hideWarning() {
        warningAlert.classList.add("hidden");
    }

    function calculateStats() {
        statTotalUpdates.textContent = allReleases.length;
        
        let features = 0;
        let issues = 0;
        let changes = 0;
        
        parsedUpdates.forEach(u => {
            const cat = u.category.toLowerCase();
            if (cat === "feature") {
                features++;
            } else if (cat === "issue" || cat === "resolved" || cat === "bug") {
                issues++;
            } else {
                changes++;
            }
        });
        
        statFeatures.textContent = features;
        statIssues.textContent = issues;
        statChanges.textContent = changes;
    }

    // --- Timeline Rendering ---
    function renderTimeline() {
        timelineContainer.innerHTML = "";
        
        // Filter updates
        const filtered = parsedUpdates.filter(update => {
            // 1. Category Filter
            let categoryMatch = false;
            if (activeCategory === "all") {
                categoryMatch = true;
            } else if (activeCategory === "Change") {
                // Change matches both "Change", "Changed", "Update"
                categoryMatch = ["change", "changed", "update", "general"].includes(update.category.toLowerCase());
            } else {
                categoryMatch = update.category.toLowerCase() === activeCategory.toLowerCase();
            }
            
            // 2. Search Query Filter
            let searchMatch = true;
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                searchMatch = update.text.toLowerCase().includes(query) || 
                              update.category.toLowerCase().includes(query) ||
                              update.date.toLowerCase().includes(query);
            }
            
            return categoryMatch && searchMatch;
        });
        
        if (filtered.length === 0) {
            timelineContainer.classList.add("hidden");
            emptyState.classList.remove("hidden");
            return;
        }
        
        emptyState.classList.add("hidden");
        timelineContainer.classList.remove("hidden");
        
        // Group by Date
        const groups = {};
        filtered.forEach(update => {
            if (!groups[update.date]) {
                groups[update.date] = {
                    date: update.date,
                    link: update.link,
                    items: []
                };
            }
            groups[update.date].items.push(update);
        });
        
        // Render groups
        Object.values(groups).forEach(group => {
            const groupEl = document.createElement("div");
            groupEl.className = "timeline-group";
            
            // Node icon on the line
            const nodeEl = document.createElement("div");
            nodeEl.className = "timeline-node";
            groupEl.appendChild(nodeEl);
            
            // Header (Date)
            const headerEl = document.createElement("div");
            headerEl.className = "timeline-date-header";
            
            const titleEl = document.createElement("h2");
            titleEl.textContent = group.date;
            headerEl.appendChild(titleEl);
            
            if (group.link) {
                const linkEl = document.createElement("a");
                linkEl.className = "feed-source-link";
                linkEl.href = group.link;
                linkEl.target = "_blank";
                linkEl.rel = "noopener noreferrer";
                linkEl.innerHTML = `
                    <span>Official Release Page</span>
                    <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <line x1="10" y1="14" x2="21" y2="3"></line>
                    </svg>
                `;
                headerEl.appendChild(linkEl);
            }
            groupEl.appendChild(headerEl);
            
            // Render each card inside this date
            group.items.forEach(item => {
                const cardEl = document.createElement("div");
                const catClass = getCategoryClass(item.category);
                cardEl.className = `update-card glass-panel cat-${catClass}`;
                
                const cardHeader = document.createElement("div");
                cardHeader.className = "update-card-header";
                
                const badge = document.createElement("span");
                badge.className = `category-badge badge-${catClass}`;
                badge.textContent = item.category;
                cardHeader.appendChild(badge);
                
                const tweetBtn = document.createElement("button");
                tweetBtn.className = "tweet-action-btn";
                tweetBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                    <span>Tweet</span>
                `;
                tweetBtn.addEventListener("click", () => openTweetModal(item));
                cardHeader.appendChild(tweetBtn);
                cardEl.appendChild(cardHeader);
                
                const contentEl = document.createElement("div");
                contentEl.className = "update-card-content";
                contentEl.innerHTML = item.html;
                cardEl.appendChild(contentEl);
                
                groupEl.appendChild(cardEl);
            });
            
            timelineContainer.appendChild(groupEl);
        });
    }

    function getCategoryClass(category) {
        const cat = category.toLowerCase();
        if (cat === "feature") return "feature";
        if (cat === "issue" || cat === "resolved" || cat === "bug") return "issue";
        if (cat === "change" || cat === "changed" || cat === "update") return "change";
        if (cat === "deprecated" || cat === "deprecation") return "deprecated";
        return "other";
    }

    // --- Tweet Customizer & Modal Logic ---
    function openTweetModal(item) {
        // Build default tweet structure
        let tweetTag = item.category;
        let emoji = "📢";
        if (tweetTag.toLowerCase() === "feature") emoji = "🚀";
        if (tweetTag.toLowerCase() === "issue") emoji = "⚠️";
        if (tweetTag.toLowerCase() === "deprecated") emoji = "🚫";
        
        let cleanText = item.text
            .replace(/\s+/g, " ") // Clean double whitespaces
            .substring(0, 160); // Preview limit for text to fit link
            
        if (item.text.length > 160) {
            cleanText += "...";
        }
        
        const tweetText = `${emoji} BigQuery ${item.category} (${item.date}):\n\n${cleanText}\n\nRead more: ${item.link}`;
        
        tweetTextarea.value = tweetText;
        updateCharCounter();
        
        tweetModal.classList.add("show");
        tweetTextarea.focus();
    }

    function closeTweetModal() {
        tweetModal.classList.remove("show");
    }

    function updateCharCounter() {
        const len = tweetTextarea.value.length;
        const maxLimit = 280;
        const remaining = maxLimit - len;
        
        charCountNum.textContent = remaining;
        
        // Progress Ring calculation
        // Circumference is 2 * PI * r = 2 * 3.14159 * 11 = ~69.11
        const circumference = 69.11;
        const percentage = Math.min(len, maxLimit) / maxLimit;
        const strokeDashoffset = circumference - (percentage * circumference);
        charLimitRing.style.strokeDashoffset = strokeDashoffset;
        
        // Colors & Alert Thresholds
        const charText = document.getElementById("char-count-num");
        
        charText.classList.remove("warn", "danger");
        charLimitRing.classList.remove("ring-warn", "ring-danger");
        
        if (remaining <= 0) {
            charText.classList.add("danger");
            charLimitRing.style.stroke = "#EF4444";
        } else if (remaining <= 20) {
            charText.classList.add("warn");
            charLimitRing.style.stroke = "#F59E0B";
        } else {
            charLimitRing.style.stroke = "#1D9BF0";
        }
    }

    function copyTweetText() {
        tweetTextarea.select();
        navigator.clipboard.writeText(tweetTextarea.value)
            .then(() => {
                showToast("Copied to clipboard!");
            })
            .catch(err => {
                console.error("Failed to copy tweet:", err);
                showToast("Failed to copy. Please copy manually.");
            });
    }

    function postTweet() {
        const text = tweetTextarea.value;
        const encoded = encodeURIComponent(text);
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encoded}`;
        
        window.open(twitterUrl, "_blank", "noopener,noreferrer");
        closeTweetModal();
        showToast("Opened Twitter Share Screen!");
    }

    // --- Toast Notification ---
    function showToast(message) {
        let toast = document.querySelector(".toast");
        if (!toast) {
            toast = document.createElement("div");
            toast.className = "toast";
            document.body.appendChild(toast);
        }
        
        toast.innerHTML = `
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>${message}</span>
        `;
        
        // Trigger reflow to restart animation
        toast.offsetHeight;
        toast.classList.add("show");
        
        setTimeout(() => {
            toast.classList.remove("show");
        }, 2500);
    }

    // --- Event Listeners ---
    refreshBtn.addEventListener("click", () => fetchReleases(true));
    
    // Live Search
    searchInput.addEventListener("input", (e) => {
        searchQuery = e.target.value;
        if (searchQuery) {
            clearSearchBtn.classList.remove("hidden");
        } else {
            clearSearchBtn.classList.add("hidden");
        }
        renderTimeline();
    });
    
    clearSearchBtn.addEventListener("click", () => {
        searchInput.value = "";
        searchQuery = "";
        clearSearchBtn.classList.add("hidden");
        renderTimeline();
    });
    
    // Category Filter Pills
    categoryFilters.addEventListener("click", (e) => {
        const target = e.target;
        if (target.classList.contains("pill-btn")) {
            // Toggle active pill style
            categoryFilters.querySelectorAll(".pill-btn").forEach(btn => btn.classList.remove("active"));
            target.classList.add("active");
            
            activeCategory = target.dataset.category;
            renderTimeline();
        }
    });
    
    // Reset Filters button (empty state)
    resetFiltersBtn.addEventListener("click", () => {
        searchInput.value = "";
        searchQuery = "";
        clearSearchBtn.classList.add("hidden");
        
        categoryFilters.querySelectorAll(".pill-btn").forEach(btn => btn.classList.remove("active"));
        categoryFilters.querySelector('[data-category="all"]').classList.add("active");
        activeCategory = "all";
        
        renderTimeline();
    });
    
    // Tweet Textarea Event Listener
    tweetTextarea.addEventListener("input", updateCharCounter);
    
    // Close Modal Events
    closeModalBtn.addEventListener("click", closeTweetModal);
    
    tweetModal.addEventListener("click", (e) => {
        if (e.target === tweetModal) {
            closeTweetModal();
        }
    });
    
    // Actions inside Tweet modal
    copyTweetBtn.addEventListener("click", copyTweetText);
    postTweetBtn.addEventListener("click", postTweet);
    
    // Handle Escape key to close modal
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && tweetModal.classList.contains("show")) {
            closeTweetModal();
        }
    });

    // --- Initialization ---
    fetchReleases();
});
