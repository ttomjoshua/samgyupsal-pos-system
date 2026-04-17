import EmptyState from '../../../shared/components/common/EmptyState'
import { peso } from '../../../shared/utils/formatters'

function ProductGrid({ products, cart = [], setCart, onProductAdded }) {
  const cartQuantityByProductId = new Map(
    cart.map((item) => [String(item.id), Number(item.quantity || 0)]),
  )

  const addToCart = (product) => {
    const availableStock = Number(product.stockQuantity)
    const quantityAlreadyInCart =
      cartQuantityByProductId.get(String(product.id)) || 0

    if (Number.isFinite(availableStock) && quantityAlreadyInCart >= availableStock) {
      return
    }

    setCart((previousCart) => {
      const existingItem = previousCart.find((item) => item.id === product.id)

      if (existingItem) {
        if (
          Number.isFinite(availableStock) &&
          Number(existingItem.quantity || 0) >= availableStock
        ) {
          return previousCart
        }

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
      {products.map((product) => {
        const availableStock = Number(product.stockQuantity)
        const quantityInCart =
          cartQuantityByProductId.get(String(product.id)) || 0
        const remainingStock = Number.isFinite(availableStock)
          ? Math.max(0, availableStock - quantityInCart)
          : null
        const isOutOfStock = remainingStock === 0

        return (
          <button
            key={product.id}
            type="button"
            className={isOutOfStock ? 'product-card product-card-disabled' : 'product-card'}
            onClick={() => addToCart(product)}
            disabled={isOutOfStock}
          >
            <span className="product-category">{product.category}</span>
            <strong>{product.name}</strong>
            <span className="product-price">{peso(product.price)}</span>
            <span className="product-stock">
              {remainingStock == null
                ? 'Stock pending'
                : remainingStock === 0
                  ? 'Out of stock'
                  : `${remainingStock} left`}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export default ProductGrid
