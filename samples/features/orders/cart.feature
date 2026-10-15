@manual
Feature: Shopping cart

  Background:
    Given I am logged in with a test account

  @REQ-30
  Rule: The cart total follows its content

    Background:
      Given my cart is empty

    @TC-CRT-01 @critical
    Scenario: Adding products updates the total
      When I add these products to my cart:
        | product | quantity | unit price |
        | Pen     | 2        | 1.50       |
        | Notepad | 1        | 3.00       |
      Then the cart total is 6.00

    @TC-CRT-02 @standard
    Scenario: A discount code is applied to the total
      Test data: The discount code SAMPLE10 gives 10 %.
      Given my cart contains products for 20.00
      When I enter the discount code "SAMPLE10"
      Then the cart total is 18.00
      And the order summary shows:
        """
        Subtotal: 20.00
        Discount: -2.00
        Total:    18.00
        """
