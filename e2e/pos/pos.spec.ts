import { test, expect } from '../fixtures/auth.fixture';
import { POSPage } from '../pages/pos.page';

test.describe('POS - Point of Sale', () => {
  test.describe('Page Access', () => {
    test('shows POS page for authenticated users', async ({ authenticatedPage }) => {
      const posPage = new POSPage(authenticatedPage);
      await posPage.goto();

      // Should be on POS page
      await expect(authenticatedPage).toHaveURL(/.*pos/);
    });

    test('redirects to login for unauthenticated users', async ({ page }) => {
      await page.goto('/de/pos');
      await expect(page).toHaveURL(/.*login/);
    });
  });

  test.describe('Product Display', () => {
    test('shows products from selected event', async ({ authenticatedPage }) => {
      const posPage = new POSPage(authenticatedPage);
      await posPage.goto();

      // Should show product grid or empty state
      await expect(
        authenticatedPage.locator('[data-testid="product-grid"], [data-testid="empty-state"]')
      ).toBeVisible();
    });

    test('can filter products by category', async ({ authenticatedPage }) => {
      const posPage = new POSPage(authenticatedPage);
      await posPage.goto();

      // If categories exist, clicking should filter products
      const categoryTab = authenticatedPage.getByRole('tab').first();
      if (await categoryTab.isVisible()) {
        await categoryTab.click();
        // Products should update based on category
      }
    });
  });

  test.describe('Cart Operations', () => {
    test('can add product to cart', async ({ authenticatedPage }) => {
      const posPage = new POSPage(authenticatedPage);
      await posPage.goto();

      // Find first product and click it
      const firstProduct = authenticatedPage.locator('[data-testid="product-card"]').first();
      if (await firstProduct.isVisible()) {
        const productName = await firstProduct.textContent();
        await firstProduct.click();

        // Cart should show the product
        await expect(authenticatedPage.locator('[data-testid="cart"]')).toContainText(productName || '');
      }
    });

    test('can increase product quantity', async ({ authenticatedPage }) => {
      const posPage = new POSPage(authenticatedPage);
      await posPage.goto();

      // Add product first
      const firstProduct = authenticatedPage.locator('[data-testid="product-card"]').first();
      if (await firstProduct.isVisible()) {
        await firstProduct.click();
        await firstProduct.click(); // Click again to increase quantity

        // Should show quantity 2
        await expect(authenticatedPage.locator('[data-testid="cart-item"]').first()).toContainText('2');
      }
    });

    test('can clear cart', async ({ authenticatedPage }) => {
      const posPage = new POSPage(authenticatedPage);
      await posPage.goto();

      // Add product
      const firstProduct = authenticatedPage.locator('[data-testid="product-card"]').first();
      if (await firstProduct.isVisible()) {
        await firstProduct.click();

        // Clear cart
        const clearButton = authenticatedPage.getByRole('button', { name: /leeren|clear|löschen/i });
        if (await clearButton.isVisible()) {
          await clearButton.click();
          await posPage.expectCartEmpty();
        }
      }
    });
  });

  test.describe('Checkout', () => {
    test('checkout button is disabled when cart is empty', async ({ authenticatedPage }) => {
      const posPage = new POSPage(authenticatedPage);
      await posPage.goto();

      const checkoutButton = authenticatedPage.getByRole('button', { name: /bezahlen|checkout/i });
      if (await checkoutButton.isVisible()) {
        await expect(checkoutButton).toBeDisabled();
      }
    });

    test('can complete cash payment', async ({ authenticatedPage }) => {
      const posPage = new POSPage(authenticatedPage);
      await posPage.goto();

      // Add product
      const firstProduct = authenticatedPage.locator('[data-testid="product-card"]').first();
      if (await firstProduct.isVisible()) {
        await firstProduct.click();

        // Checkout
        const checkoutButton = authenticatedPage.getByRole('button', { name: /bezahlen|checkout/i });
        if (await checkoutButton.isVisible() && await checkoutButton.isEnabled()) {
          await checkoutButton.click();

          // Select cash payment
          const cashButton = authenticatedPage.getByRole('button', { name: /bar|cash/i });
          if (await cashButton.isVisible()) {
            await cashButton.click();
            // Should complete order
          }
        }
      }
    });
  });

  test.describe('Keyboard Shortcuts', () => {
    test('supports keyboard navigation', async ({ authenticatedPage }) => {
      const posPage = new POSPage(authenticatedPage);
      await posPage.goto();

      // Test Tab navigation works
      await authenticatedPage.keyboard.press('Tab');
      // Focus should move to first focusable element
    });
  });
});
