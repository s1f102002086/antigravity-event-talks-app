from flask import Flask, jsonify, render_template, request
import requests
import xml.etree.ElementTree as ET
from datetime import datetime
import os

app = Flask(__name__)

# Simple in-memory cache
feed_cache = {
    "data": None,
    "last_fetched": None
}

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

def fetch_and_parse_feed():
    try:
        response = requests.get(FEED_URL, timeout=10)
        response.raise_for_status()
        
        root = ET.fromstring(response.content)
        ns = {"atom": "http://www.w3.org/2005/Atom"}
        
        entries = []
        for entry_el in root.findall("atom:entry", ns):
            title_el = entry_el.find("atom:title", ns)
            id_el = entry_el.find("atom:id", ns)
            updated_el = entry_el.find("atom:updated", ns)
            content_el = entry_el.find("atom:content", ns)
            
            # Extract links, preferring the 'alternate' link if available
            link_el = entry_el.find("atom:link[@rel='alternate']", ns)
            if link_el is None:
                link_el = entry_el.find("atom:link", ns)
            link = link_el.attrib.get("href", "") if link_el is not None else ""
            
            # Extract content text (which is raw HTML)
            content = content_el.text if content_el is not None else ""
            
            entries.append({
                "id": id_el.text if id_el is not None else "",
                "title": title_el.text if title_el is not None else "",
                "updated": updated_el.text if updated_el is not None else "",
                "link": link,
                "content": content
            })
            
        feed_cache["data"] = entries
        feed_cache["last_fetched"] = datetime.now().isoformat()
        return True, None
    except Exception as e:
        return False, str(e)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/releases")
def get_releases():
    force_refresh = request.args.get("refresh", "false").lower() == "true"
    
    # Fetch if cache is empty or if refresh is requested
    if feed_cache["data"] is None or force_refresh:
        success, error = fetch_and_parse_feed()
        if not success:
            # If fetch failed but we have cached data, fall back to cached data with a warning
            if feed_cache["data"] is not None:
                return jsonify({
                    "success": True,
                    "releases": feed_cache["data"],
                    "last_fetched": feed_cache["last_fetched"],
                    "warning": f"Failed to refresh feed, showing cached version: {error}"
                })
            return jsonify({
                "success": False,
                "error": f"Failed to fetch release notes: {error}"
            }), 500
            
    return jsonify({
        "success": True,
        "releases": feed_cache["data"],
        "last_fetched": feed_cache["last_fetched"]
    })

if __name__ == "__main__":
    # Run server locally on port 5000
    app.run(host="0.0.0.0", port=5000, debug=True)
