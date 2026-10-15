@manual
Feature: User profile

  @TC-PRF-01 @REQ-12 @critical
  Scenario: A new display name is kept after logging in again
    Objective: Check that a profile change is saved and shown everywhere.
    Test data: A test account with a known display name.
    Given I am logged in with a test account
    When I change my display name
    And I log out and log in again
    Then the new display name is shown in the header
    And the new display name is shown on the profile page

  @TC-PRF-02 @REQ-12 @REQ-13 @standard @JIRA-DEMO-42
  Scenario: A profile picture can be replaced
    Objective: Check that uploading a new picture replaces the old one.
    Test data: Two PNG images under 1 MB.
    Cleanup: Restore the default picture.
    # Note: Use the images from the shared test data folder.
    Given I am logged in with a test account
    And my profile has a picture
    When I upload a new picture
    Then the new picture is shown on the profile page
