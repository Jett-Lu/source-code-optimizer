export const examples = {
  js: `// Calculate the total price for a list of items.
// Each item: { price, quantity, discount? }

function calculateTotal(items, options = {}) {
  const { taxRate = 0, shipping = 0 } = options;
  let subtotal = 0;

  for (const item of items) {
    const price = Number(item.price) || 0;
    const quantity = Number(item.quantity) || 0;
    const discount = Number(item.discount) || 0;
    subtotal += price * quantity * (1 - discount);
  }

  const total = subtotal * (1 + taxRate) + shipping;
  return Number(total.toFixed(2));
}`,
  css: `/* A little room to breathe. */
.welcome {
  color: #ffffff;
  background-color: #176b4a;
  padding: 24px 24px 24px 24px;
  margin: 0px 0px 16px 0px;
  border-radius: 8px;
}

.welcome::after {
  content: "Hello, world.";
  display: block;
  margin-top: 16px;
}`,
  html: `<!DOCTYPE html>
<html lang="en">
  <head>
    <!-- Page information -->
    <meta charset="UTF-8">
    <title>A smaller beginning</title>
  </head>
  <body>
    <!-- Welcome section -->
    <main>
      <h1>Hello, world.</h1>
      <p>A little less code. A little more room.</p>
      <pre>Keep  this  spacing.</pre>
    </main>
  </body>
</html>`,
};
