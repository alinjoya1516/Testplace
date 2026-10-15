@manual @smoke
Feature: Login

  Background:
    Given the login page is open

  @TC-LOG-01 @REQ-20 @critical
  Scenario Outline: A user with a <role> account can log in
    Objective: Check that every role reaches its own home page.
    Test data: One test account per role.
    When I log in as "<login>"
    Then I see the <home> page

    Examples: Staff
      | role          | login      | home      |
      | administrator | admin.test | dashboard |
      | executor      | exec.test  | my tests  |

    @REQ-21
    Examples: External
      | role   | login       | home    |
      | reader | reader.test | reports |

  @TC-LOG-02 @REQ-22 @standard @quarantine
  Scenario: The account is locked after five wrong passwords
    When I enter a wrong password five times
    Then the account is locked
    And an unlock link is sent by email

  @TC-LOG-03 @REQ-22 @standard
  Scenario: A locked account can be unlocked from the email
    # TODO: Ask the product owner how long the unlock link stays valid.
    Given my account is locked
    When I open the unlock link
    Then I can log in again
