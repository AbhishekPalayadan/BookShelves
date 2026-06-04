function getBestOffer(product) {
  const now = new Date();

  let productOffer = 0;
  let categoryOffer = 0;

  if (product.offerPercentage && product.offerStartDate && product.offerEndDate) {
    const start = new Date(product.offerStartDate);
    const end = new Date(product.offerEndDate);

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    if (start <= now && end >= now) {
      productOffer = product.offerPercentage;
    }
  }

  const cat = product.category_id;
  if (
    cat &&
    typeof cat === 'object' &&          
    cat.offerPercentage > 0 &&
    cat.offerStartDate && cat.offerEndDate
  ) {
    const catStart = new Date(cat.offerStartDate);
    const catEnd = new Date(cat.offerEndDate);

    catStart.setHours(0, 0, 0, 0);
    catEnd.setHours(23, 59, 59, 999);

    if (catStart <= now && catEnd >= now) {
      categoryOffer = cat.offerPercentage;  
    }
  }

  if (productOffer >= categoryOffer) {
    return { offer: productOffer, type: "product" };
  } else {
    return { offer: categoryOffer, type: "category" };
  }
}

module.exports = { getBestOffer };