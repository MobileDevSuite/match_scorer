#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Football Match Tracker
Tests all endpoints with realistic football data
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL from frontend .env
BASE_URL = "https://match-stats-76.preview.emergentagent.com/api"

class FootballAPITester:
    def __init__(self):
        self.base_url = BASE_URL
        self.session = requests.Session()
        self.test_match_id = None
        self.test_event_ids = []
        self.results = {
            "passed": 0,
            "failed": 0,
            "errors": []
        }

    def log_result(self, test_name, success, message="", response=None):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if message:
            print(f"   {message}")
        if response and not success:
            print(f"   Response: {response.status_code} - {response.text[:200]}")
        
        if success:
            self.results["passed"] += 1
        else:
            self.results["failed"] += 1
            self.results["errors"].append(f"{test_name}: {message}")
        print()

    def test_health_check(self):
        """Test GET /api/health"""
        try:
            response = self.session.get(f"{self.base_url}/health")
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "healthy":
                    self.log_result("Health Check", True, "API is healthy")
                    return True
                else:
                    self.log_result("Health Check", False, f"Unexpected response: {data}", response)
            else:
                self.log_result("Health Check", False, f"HTTP {response.status_code}", response)
        except Exception as e:
            self.log_result("Health Check", False, f"Exception: {str(e)}")
        return False

    def test_create_match(self):
        """Test POST /api/matches"""
        try:
            match_data = {
                "home_team": "Manchester United",
                "away_team": "Liverpool FC"
            }
            response = self.session.post(
                f"{self.base_url}/matches",
                json=match_data
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("home_team") == "Manchester United" and data.get("away_team") == "Liverpool FC":
                    self.test_match_id = data.get("id")
                    self.log_result("Create Match", True, f"Match created with ID: {self.test_match_id}")
                    return True
                else:
                    self.log_result("Create Match", False, f"Invalid match data: {data}", response)
            else:
                self.log_result("Create Match", False, f"HTTP {response.status_code}", response)
        except Exception as e:
            self.log_result("Create Match", False, f"Exception: {str(e)}")
        return False

    def test_get_matches(self):
        """Test GET /api/matches"""
        try:
            response = self.session.get(f"{self.base_url}/matches")
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_result("Get Matches List", True, f"Retrieved {len(data)} matches")
                    return True
                else:
                    self.log_result("Get Matches List", False, f"Expected list, got: {type(data)}", response)
            else:
                self.log_result("Get Matches List", False, f"HTTP {response.status_code}", response)
        except Exception as e:
            self.log_result("Get Matches List", False, f"Exception: {str(e)}")
        return False

    def test_get_single_match(self):
        """Test GET /api/matches/{match_id}"""
        if not self.test_match_id:
            self.log_result("Get Single Match", False, "No test match ID available")
            return False
            
        try:
            response = self.session.get(f"{self.base_url}/matches/{self.test_match_id}")
            if response.status_code == 200:
                data = response.json()
                if data.get("id") == self.test_match_id:
                    self.log_result("Get Single Match", True, f"Retrieved match: {data.get('home_team')} vs {data.get('away_team')}")
                    return True
                else:
                    self.log_result("Get Single Match", False, f"Match ID mismatch", response)
            else:
                self.log_result("Get Single Match", False, f"HTTP {response.status_code}", response)
        except Exception as e:
            self.log_result("Get Single Match", False, f"Exception: {str(e)}")
        return False

    def test_update_match_status(self):
        """Test PATCH /api/matches/{match_id}"""
        if not self.test_match_id:
            self.log_result("Update Match Status", False, "No test match ID available")
            return False
            
        try:
            update_data = {
                "status": "first_half",
                "current_minute": 15
            }
            response = self.session.patch(
                f"{self.base_url}/matches/{self.test_match_id}",
                json=update_data
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "first_half" and data.get("current_minute") == 15:
                    self.log_result("Update Match Status", True, "Match status updated to first_half, minute 15")
                    return True
                else:
                    self.log_result("Update Match Status", False, f"Update failed: {data}", response)
            else:
                self.log_result("Update Match Status", False, f"HTTP {response.status_code}", response)
        except Exception as e:
            self.log_result("Update Match Status", False, f"Exception: {str(e)}")
        return False

    def test_add_events(self):
        """Test POST /api/matches/{match_id}/events"""
        if not self.test_match_id:
            self.log_result("Add Events", False, "No test match ID available")
            return False

        events_to_test = [
            {
                "event_type": "goal",
                "team": "home",
                "minute": 23,
                "player_name": "Marcus Rashford"
            },
            {
                "event_type": "corner",
                "team": "away",
                "minute": 31
            },
            {
                "event_type": "penalty",
                "team": "away",
                "minute": 45,
                "player_name": "Mohamed Salah"
            },
            {
                "event_type": "substitution",
                "team": "home",
                "minute": 60,
                "player_out": "Anthony Martial",
                "player_in": "Mason Greenwood"
            },
            {
                "event_type": "yellow_card",
                "team": "away",
                "minute": 67,
                "player_name": "Virgil van Dijk"
            },
            {
                "event_type": "red_card",
                "team": "home",
                "minute": 78,
                "player_name": "Paul Pogba"
            }
        ]

        success_count = 0
        for i, event in enumerate(events_to_test):
            try:
                response = self.session.post(
                    f"{self.base_url}/matches/{self.test_match_id}/events",
                    json=event
                )
                
                if response.status_code == 200:
                    data = response.json()
                    # Store event ID for later deletion test
                    if data.get("events"):
                        latest_event = data["events"][-1]
                        self.test_event_ids.append(latest_event["id"])
                    
                    event_desc = f"{event['event_type']} - {event['team']} team - minute {event['minute']}"
                    self.log_result(f"Add Event {i+1}", True, f"Added: {event_desc}")
                    success_count += 1
                else:
                    self.log_result(f"Add Event {i+1}", False, f"HTTP {response.status_code}", response)
            except Exception as e:
                self.log_result(f"Add Event {i+1}", False, f"Exception: {str(e)}")

        return success_count == len(events_to_test)

    def test_match_summary(self):
        """Test GET /api/matches/{match_id}/summary"""
        if not self.test_match_id:
            self.log_result("Match Summary", False, "No test match ID available")
            return False
            
        try:
            response = self.session.get(f"{self.base_url}/matches/{self.test_match_id}/summary")
            if response.status_code == 200:
                data = response.json()
                required_fields = ["match_id", "home_team", "away_team", "final_score", "statistics", "timeline"]
                
                if all(field in data for field in required_fields):
                    stats = data.get("statistics", {})
                    timeline = data.get("timeline", {})
                    
                    # Verify statistics structure
                    stat_types = ["goals", "corners", "penalties", "substitutions", "yellow_cards", "red_cards"]
                    stats_valid = all(stat in stats for stat in stat_types)
                    
                    # Verify timeline structure  
                    timeline_types = ["goals", "penalties", "corners", "substitutions", "cards"]
                    timeline_valid = all(ttype in timeline for ttype in timeline_types)
                    
                    if stats_valid and timeline_valid:
                        self.log_result("Match Summary", True, f"Complete summary with {data.get('total_events', 0)} events")
                        return True
                    else:
                        self.log_result("Match Summary", False, "Missing statistics or timeline data", response)
                else:
                    self.log_result("Match Summary", False, f"Missing required fields: {required_fields}", response)
            else:
                self.log_result("Match Summary", False, f"HTTP {response.status_code}", response)
        except Exception as e:
            self.log_result("Match Summary", False, f"Exception: {str(e)}")
        return False

    def test_delete_event(self):
        """Test DELETE /api/matches/{match_id}/events/{event_id}"""
        if not self.test_match_id or not self.test_event_ids:
            self.log_result("Delete Event", False, "No test match ID or event IDs available")
            return False
            
        try:
            # Delete the first event we created
            event_id = self.test_event_ids[0]
            response = self.session.delete(f"{self.base_url}/matches/{self.test_match_id}/events/{event_id}")
            
            if response.status_code == 200:
                data = response.json()
                # Verify the event was removed from the events list
                remaining_events = data.get("events", [])
                event_still_exists = any(e["id"] == event_id for e in remaining_events)
                
                if not event_still_exists:
                    self.log_result("Delete Event", True, f"Event {event_id} successfully removed")
                    return True
                else:
                    self.log_result("Delete Event", False, "Event still exists after deletion", response)
            else:
                self.log_result("Delete Event", False, f"HTTP {response.status_code}", response)
        except Exception as e:
            self.log_result("Delete Event", False, f"Exception: {str(e)}")
        return False

    def test_delete_match(self):
        """Test DELETE /api/matches/{match_id}"""
        if not self.test_match_id:
            self.log_result("Delete Match", False, "No test match ID available")
            return False
            
        try:
            response = self.session.delete(f"{self.base_url}/matches/{self.test_match_id}")
            if response.status_code == 200:
                data = response.json()
                if "deleted successfully" in data.get("message", "").lower():
                    self.log_result("Delete Match", True, "Match successfully deleted")
                    return True
                else:
                    self.log_result("Delete Match", False, f"Unexpected response: {data}", response)
            else:
                self.log_result("Delete Match", False, f"HTTP {response.status_code}", response)
        except Exception as e:
            self.log_result("Delete Match", False, f"Exception: {str(e)}")
        return False

    def run_all_tests(self):
        """Run all API tests in sequence"""
        print(f"🚀 Starting Football Match Tracker API Tests")
        print(f"📍 Testing against: {self.base_url}")
        print("=" * 60)
        
        # Test sequence following the review request
        tests = [
            ("Health Check", self.test_health_check),
            ("Create Match", self.test_create_match),
            ("Get Matches List", self.test_get_matches),
            ("Get Single Match", self.test_get_single_match),
            ("Update Match Status", self.test_update_match_status),
            ("Add Events", self.test_add_events),
            ("Match Summary", self.test_match_summary),
            ("Delete Event", self.test_delete_event),
            ("Delete Match", self.test_delete_match)
        ]
        
        for test_name, test_func in tests:
            print(f"🧪 Running: {test_name}")
            test_func()
        
        # Final summary
        print("=" * 60)
        print(f"📊 TEST SUMMARY")
        print(f"✅ Passed: {self.results['passed']}")
        print(f"❌ Failed: {self.results['failed']}")
        print(f"📈 Success Rate: {(self.results['passed']/(self.results['passed']+self.results['failed'])*100):.1f}%")
        
        if self.results["errors"]:
            print(f"\n🚨 FAILED TESTS:")
            for error in self.results["errors"]:
                print(f"   • {error}")
        
        return self.results["failed"] == 0

if __name__ == "__main__":
    tester = FootballAPITester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)