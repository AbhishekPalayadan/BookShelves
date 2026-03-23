function getBestOffer(product) {
  const now = new Date();

  let productOffer = 0;
  let categoryOffer = 0;

  const start = new Date(product.offerStartDate);
  const end = new Date(product.offerEndDate);

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  if (
    product.offerPercentage &&
    start <= now &&
    end >= now
  ) {
    productOffer = product.offerPercentage;
  }

  if (
    product.category_id &&
    product.category_id.offer &&
    product.category_id.offer > 0
  ) {
    categoryOffer = product.category_id.offer;
  }

  if (productOffer >= categoryOffer) {
    return {
      offer: productOffer,
      type: "product"
    };
  } else {
    return {
      offer: categoryOffer,
      type: "category"
    };
  }
}

module.exports = { getBestOffer };