#!/usr/bin/env python3
"""
Additional test to verify counter functionality and statistics accuracy
"""

import requests
import json

BASE_URL = "https://match-stats-76.preview.emergentagent.com/api"

def test_counter_accuracy():
    """Test that event counters increment and decrement correctly"""
    session = requests.Session()
    
    print("🧮 Testing Counter Accuracy")
    print("=" * 40)
    
    # Create a test match
    match_data = {
        "home_team": "Arsenal",
        "away_team": "Chelsea"
    }
    response = session.post(f"{BASE_URL}/matches", json=match_data)
    match_id = response.json()["id"]
    print(f"✅ Created test match: {match_id}")
    
    # Add multiple events of the same type to test counters
    events = [
        {"event_type": "goal", "team": "home", "minute": 10, "player_name": "Bukayo Saka"},
        {"event_type": "goal", "team": "home", "minute": 25, "player_name": "Gabriel Jesus"},
        {"event_type": "goal", "team": "away", "minute": 30, "player_name": "Raheem Sterling"},
        {"event_type": "corner", "team": "home", "minute": 15},
        {"event_type": "corner", "team": "home", "minute": 20},
        {"event_type": "corner", "team": "away", "minute": 35},
        {"event_type": "yellow_card", "team": "home", "minute": 40, "player_name": "Thomas Partey"},
        {"event_type": "yellow_card", "team": "away", "minute": 45, "player_name": "N'Golo Kante"}
    ]
    
    event_ids = []
    for event in events:
        response = session.post(f"{BASE_URL}/matches/{match_id}/events", json=event)
        if response.status_code == 200:
            data = response.json()
            latest_event = data["events"][-1]
            event_ids.append(latest_event["id"])
    
    print(f"✅ Added {len(events)} events")
    
    # Get match summary to check counters
    response = session.get(f"{BASE_URL}/matches/{match_id}/summary")
    summary = response.json()
    stats = summary["statistics"]
    
    # Verify counters
    expected_home_goals = 2
    expected_away_goals = 1
    expected_home_corners = 2
    expected_away_corners = 1
    expected_home_yellows = 1
    expected_away_yellows = 1
    
    print("\n📊 Counter Verification:")
    print(f"Home Goals: {stats['goals']['home']} (expected: {expected_home_goals}) {'✅' if stats['goals']['home'] == expected_home_goals else '❌'}")
    print(f"Away Goals: {stats['goals']['away']} (expected: {expected_away_goals}) {'✅' if stats['goals']['away'] == expected_away_goals else '❌'}")
    print(f"Home Corners: {stats['corners']['home']} (expected: {expected_home_corners}) {'✅' if stats['corners']['home'] == expected_home_corners else '❌'}")
    print(f"Away Corners: {stats['corners']['away']} (expected: {expected_away_corners}) {'✅' if stats['corners']['away'] == expected_away_corners else '❌'}")
    print(f"Home Yellow Cards: {stats['yellow_cards']['home']} (expected: {expected_home_yellows}) {'✅' if stats['yellow_cards']['home'] == expected_home_yellows else '❌'}")
    print(f"Away Yellow Cards: {stats['yellow_cards']['away']} (expected: {expected_away_yellows}) {'✅' if stats['yellow_cards']['away'] == expected_away_yellows else '❌'}")
    
    # Test counter decrement by deleting an event
    print(f"\n🗑️ Testing Counter Decrement:")
    if event_ids:
        # Delete the first goal (home team)
        response = session.delete(f"{BASE_URL}/matches/{match_id}/events/{event_ids[0]}")
        if response.status_code == 200:
            print("✅ Deleted first goal event")
            
            # Check if counter decremented
            response = session.get(f"{BASE_URL}/matches/{match_id}/summary")
            new_summary = response.json()
            new_stats = new_summary["statistics"]
            
            expected_home_goals_after_delete = 1
            print(f"Home Goals after deletion: {new_stats['goals']['home']} (expected: {expected_home_goals_after_delete}) {'✅' if new_stats['goals']['home'] == expected_home_goals_after_delete else '❌'}")
    
    # Clean up
    session.delete(f"{BASE_URL}/matches/{match_id}")
    print(f"\n🧹 Cleaned up test match")
    
    return True

if __name__ == "__main__":
    test_counter_accuracy()