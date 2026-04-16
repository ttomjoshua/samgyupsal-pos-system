import EmptyState from '../../../shared/components/common/EmptyState'
import { peso } from '../../../shared/utils/formatters'

function ProductGrid({ products, setCart, onProductAdded }) {
  const addToCart = (product) => {
    setCart((previousCart) => {
      const existingItem = previousCart.find((item) => item.id === product.id)

      if (existingItem) {
        return previousCart.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        )
      }

      return [...previousCart, { ...product, quantity: 1 }]
    })

    onProductAdded?.(product)
  }

  if (products.length === 0) {
    return (
      <EmptyState
        title="No products found"
        description="Try another keyword or switch to a different category."
      />
    )
  }

  return (
    <div className="product-grid">
      {products.map((product) => (
        <button
          key={product.id}
          type="button"
          className="product-card"
          onClick={() => addToCart(product)}
        >
          <span className="product-category">{product.category}</span>
          <strong>{product.name}</strong>
          <span className="product-price">{peso(product.price)}</span>
        </button>
      ))}
    </div>
  )
}

export default ProductGrid
