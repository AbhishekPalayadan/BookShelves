const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const fs = require("fs");
const path = require("path");
const { TMP_UPLOAD_DIR, FINAL_DIR } = require("../../middlewares/multer");

const moveImagesToFinalFolder = (files = []) => {
  const filenames = files.map((file) => file.filename);

  filenames.forEach((filename) => {
    const tmpPath = path.join(TMP_UPLOAD_DIR, filename);
    const finalPath = path.join(FINAL_DIR, filename);

    try {
      if (fs.existsSync(tmpPath)) {
        fs.renameSync(tmpPath, finalPath);
      }
    } catch (error) {
      console.error("Error moving image:", error);
    }
  });

  return filenames;
};

const deleteImagesFromFinalFolder = (filenames = []) => {
  filenames.forEach((filename) => {
    const filePath = path.join(FINAL_DIR, filename);

    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error("Error deleting image:", error);
    }
  });
};

const getProductAddPage = async (req, res) => {
  try {
    const category = await Category.find({ isListed: true });

    res.render("admin/products-add", {
      cat: category,
      activeMenu: "products",
    });
  } catch (error) {
    console.error("Error loading add product page:", error);
    res.redirect("/admin/pageError");
  }
};

const getAllProducts = async (req, res) => {
  try {
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 4;

    const sort = req.query.sort || "";
    const categoryFilter = req.query.category || "";
    const minPrice = req.query.minPrice || "";
    const maxPrice = req.query.maxPrice || "";

    const filterQuery = {
      product_name: { $regex: search, $options: "i" },
    };

    if (categoryFilter) {
      filterQuery.category_id = categoryFilter;
    }

    if (minPrice || maxPrice) {
      filterQuery.sale_price = {};

      if (minPrice) {
        filterQuery.sale_price.$gte = Number(minPrice);
      }

      if (maxPrice) {
        filterQuery.sale_price.$lte = Number(maxPrice);
      }
    }

    let sortQuery = {};

    switch (sort) {
      case "name_asc":
        sortQuery.product_name = 1;
        break;

      case "name_desc":
        sortQuery.product_name = -1;
        break;

      case "price_low":
        sortQuery.sale_price = 1;
        break;

      case "price_high":
        sortQuery.sale_price = -1;
        break;

      case "stock_low":
        sortQuery.stock = 1;
        break;

      case "stock_high":
        sortQuery.stock = -1;
        break;

      default:
        sortQuery.createdAt = -1;
    }

    const productData = await Product.find(filterQuery)
      .populate("category_id")
      .sort(sortQuery)
      .skip((page - 1) * limit)
      .limit(limit);

    const count = await Product.countDocuments(filterQuery);
    const category = await Category.find({ isListed: true });

    res.render("admin/products", {
      data: productData,
      currentPage: page,
      totalPages: Math.ceil(count / limit),
      cat: category,
      activeMenu: "products",
      query: req.query,
    });
  } catch (error) {
    console.error("Error loading products:", error);
    res.redirect("/admin/pageError");
  }
};

const addProducts = async (req, res) => {
  try {
    const data = req.body;

    const productName = data.productName?.trim();
    const author = data.author?.trim();
    const description = data.description?.trim();
    const publisher = data.publisher?.trim();
    const language = data.language?.trim();

    const regularPrice = Number(data.regularPrice);
    const salePrice = data.salePrice ? Number(data.salePrice) : 0;
    const stockQuantity = Number(data.stockQuantity);
    const pageCount = Number(data.pageCount);

    if (!productName) {
      return res.status(400).json({ message: "Product name is required" });
    }

    if (!author) {
      return res.status(400).json({ message: "Author is required" });
    }

    if (!description) {
      return res.status(400).json({ message: "Description is required" });
    }

    if (!publisher) {
      return res.status(400).json({ message: "Publisher is required" });
    }

    if (!language) {
      return res.status(400).json({ message: "Language is required" });
    }

    if (!data.publishedDate) {
      return res.status(400).json({ message: "Published date is required" });
    }

    if (!data.category) {
      return res.status(400).json({ message: "Category is required" });
    }

    if (!regularPrice || regularPrice <= 0) {
      return res.status(400).json({ message: "Regular price must be greater than 0" });
    }

    if (salePrice && salePrice > regularPrice) {
      return res.status(400).json({ message: "Sale price cannot be greater than regular price" });
    }

    if (!stockQuantity || stockQuantity < 5) {
      return res.status(400).json({ message: "Stock must be greater than or equal to 5" });
    }

    if (!pageCount || pageCount <= 0) {
      return res.status(400).json({ message: "Page count must be greater than 0" });
    }

    const productExists = await Product.findOne({
      product_name: { $regex: `^${productName}$`, $options: "i" },
    });

    if (productExists) {
      return res.status(400).json({ message: "Product already exists" });
    }

    const category = await Category.findById(data.category);

    if (!category) {
      return res.status(400).json({ message: "Invalid category selected" });
    }

    const images = moveImagesToFinalFolder(req.files || []);

    if (images.length === 0) {
      return res.status(400).json({ message: "At least one image is required" });
    }

    if (images.length > 4) {
      deleteImagesFromFinalFolder(images);
      return res.status(400).json({ message: "Maximum 4 images allowed" });
    }

    const newProduct = new Product({
      product_name: productName,
      author,
      description,
      publisher,
      pageCount,
      category_id: category._id,
      regular_price: regularPrice,
      sale_price: salePrice,
      stock: stockQuantity,
      language,
      published_date: data.publishedDate,
      images,
      status: stockQuantity > 0 ? "available" : "out_of_stock",
    });

    await newProduct.save();

    return res.redirect("/admin/products");
  } catch (error) {
    console.error("Error saving product:", error);
    return res.redirect("/admin/pageError");
  }
};

const getEditProductPage = async (req, res) => {
  try {
    const id = req.params.id;
    const page = req.query.page || 1;

    const product = await Product.findById(id).lean();

    if (!product) {
      return res.redirect("/admin/pageError");
    }

    const category = await Category.find({ isListed: true });

    res.render("admin/products-edit", {
      product,
      cat: category,
      adminName: req.user ? req.user.name : "Admin",
      activeMenu: "products",
      currentPage: page,
    });
  } catch (error) {
    console.error("Error loading edit page:", error);
    return res.redirect("/admin/pageError");
  }
};

const updateProduct = async (req, res) => {
  try {
    const id = req.params.id;
    const body = req.body;
    const page = req.query.page || 1;

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).send("Product not found");
    }

    const productName = body.productName?.trim();
    const author = body.author?.trim();
    const description = body.description?.trim();
    const publisher = body.publisher?.trim();
    const language = body.language?.trim();

    const regularPrice = Number(body.regularPrice);
    const salePrice = body.salePrice ? Number(body.salePrice) : 0;
    const stockQuantity = Number(body.stockQuantity);
    const pageCount = Number(body.pageCount);

    if (!productName) {
      return res.status(400).send("Product name is required");
    }

    if (!author) {
      return res.status(400).send("Author is required");
    }

    if (!description) {
      return res.status(400).send("Description is required");
    }

    if (!publisher) {
      return res.status(400).send("Publisher is required");
    }

    if (!language) {
      return res.status(400).send("Language is required");
    }

    if (!body.publishedDate) {
      return res.status(400).send("Published date is required");
    }

    if (!body.category) {
      return res.status(400).send("Category is required");
    }

    if (!regularPrice || regularPrice <= 0) {
      return res.status(400).send("Regular price must be greater than 0");
    }

    if (salePrice && salePrice > regularPrice) {
      return res.status(400).send("Sale price cannot be greater than regular price");
    }

    if (Number.isNaN(stockQuantity) || stockQuantity < 0) {
      return res.status(400).send("Stock must be 0 or greater");
    }

    if (!pageCount || pageCount <= 0) {
      return res.status(400).send("Page count must be greater than 0");
    }

    const category = await Category.findById(body.category);

    if (!category) {
      return res.status(400).send("Invalid category selected");
    }

    const duplicateProduct = await Product.findOne({
      _id: { $ne: id },
      product_name: { $regex: `^${productName}$`, $options: "i" },
    });

    if (duplicateProduct) {
      return res.status(400).send("Another product with this name already exists");
    }

    let keepImages = [];

    if (body.keepImages) {
      keepImages = Array.isArray(body.keepImages)
        ? body.keepImages
        : [body.keepImages];
    }

    const newImages = moveImagesToFinalFolder(req.files || []);
    const finalImages = [...keepImages, ...newImages];

    if (finalImages.length === 0) {
      deleteImagesFromFinalFolder(newImages);
      return res.status(400).send("At least one image is required");
    }

    if (finalImages.length > 4) {
      deleteImagesFromFinalFolder(newImages);
      return res.status(400).send("Maximum 4 images allowed");
    }

    const removedImages = product.images.filter(
      (image) => !finalImages.includes(image)
    );

    deleteImagesFromFinalFolder(removedImages);

    product.product_name = productName;
    product.author = author;
    product.description = description;
    product.publisher = publisher;
    product.pageCount = pageCount;
    product.category_id = category._id;
    product.regular_price = regularPrice;
    product.sale_price = salePrice;
    product.stock = stockQuantity;
    product.language = language;
    product.published_date = body.publishedDate;
    product.images = finalImages;
    product.status = stockQuantity > 0 ? "available" : "out_of_stock";

    await product.save();

    return res.redirect(`/admin/products?page=${page}`);
  } catch (error) {
    console.error("Error updating product:", error);
    return res.redirect("/admin/pageError");
  }
};

const productStatus = async (req, res) => {
  try {
    const id = req.query.id;
    const isChecked = req.query.status === "true";

    await Product.findByIdAndUpdate(id, {
      isDeleted: !isChecked,
    });

    res.redirect("/admin/products");
  } catch (error) {
    console.error("Error updating product status:", error);
    res.redirect("/admin/pageError");
  }
};

const deleteProduct = async (req, res) => {
  try {
    const id = req.params.id;

    const product = await Product.findById(id);

    if (!product) {
      return res.redirect("/admin/products");
    }

    await Product.findByIdAndUpdate(id, {
      isDeleted: true,
    });

    res.redirect("/admin/products");
  } catch (error) {
    console.error("Error deleting product:", error);
    res.redirect("/admin/pageError");
  }
};

module.exports = {
  getProductAddPage,
  getAllProducts,
  addProducts,
  getEditProductPage,
  updateProduct,
  deleteProduct,
  productStatus,
};