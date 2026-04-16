import EmptyState from '../../../shared/components/common/EmptyState'
import { peso } from '../../../shared/utils/formatters'

function CartTable({ cart, setCart }) {
  const decreaseQty = (id) => {
    setCart((previousCart) =>
      previousCart
        .map((item) =>
          item.id === id ? { ...item, quantity: item.quantity - 1 } : item,
        )
        .filter((item) => item.quantity > 0),
    )
  }

  const increaseQty = (id) => {
    setCart((previousCart) =>
      previousCart.map((item) =>
        item.id === id ? { ...item, quantity: item.quantity + 1 } : item,
      ),
    )
  }

  const removeItem = (id) => {
    setCart((previousCart) => previousCart.filter((item) => item.id !== id))
  }

  if (cart.length === 0) {
    return (
      <div className="cart-items empty">
        <EmptyState
          title="No items yet"
          description="Select products from the catalog to start a transaction."
        />
      </div>
    )
  }

  return (
    <div className="cart-items">
      <div className="cart-list">
        {cart.map((item) => (
          <article key={item.id} className="cart-item-card">
            <div className="cart-item-copy">
              <strong>{item.name}</strong>
              <span>{peso(item.price)} each</span>
            </div>

            <div className="cart-item-controls">
              <div className="quantity-controls">
                <button
                  type="button"
                  className="quantity-button"
                  onClick={() => decreaseQty(item.id)}
                >
                  -
                </button>
                <span className="quantity-value">{item.quantity}</span>
                <button
                  type="button"
                  className="quantity-button"
                  onClick={() => increaseQty(item.id)}
                >
                  +
                </button>
              </div>

              <button
                type="button"
                className="remove-item-button"
                onClick={() => removeItem(item.id)}
              >
                Remove
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

export default CartTable
