// controllers/membership/products/products.controller.js
const { connectToMongoDB } = require("../../../database/mongodb");
const { generateUniqueId } = require("../../../controllers/operation/operation");

// Helper function to send responses
function sendResponse(res, message, error, results, totalCount) {
  res.status(error ? 400 : 200).json({
    statusCode: error ? 400 : 200,
    message: message,
    data: results,
    error: error,
    totalCount: totalCount ?? 0,
  });
}

// ✅ Base image URL helper (always ends with "/")
function getBaseImageUrl() {
  const rawBaseUrl = process.env.productsImageUrl || "";
  return rawBaseUrl.endsWith("/") ? rawBaseUrl : rawBaseUrl + "/";
}

// ✅ NEW: Card image URL helper (always ends with "/")
function getCardImageUrl() {
  const rawBaseUrl = process.env.CardImageUrl || "";
  return rawBaseUrl.endsWith("/") ? rawBaseUrl : rawBaseUrl + "/";
}

// ✅ Normalize number
function toAmount(val) {
  if (val === null || val === undefined || val === "") return 0;
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

// ✅ Normalize string
function toStr(val) {
  if (val === null || val === undefined) return "";
  return String(val).trim();
}

// ✅ Format output (add ProductImageUrl + NEW Card ProductImageUrl)
function mapProduct(p) {
  const baseImageUrl = getBaseImageUrl();
  const cardImageUrl = getCardImageUrl();
  const img = toStr(p?.ProductImage);

  return {
    ...p,
    // existing (from productsImageUrl)
    ProductImageUrl: img ? baseImageUrl + img : "",

    // ✅ NEW FIELD (from CardImageUrl)
    ProductImageUrl: img ? cardImageUrl + img : "",
  };
}

/**
 * ✅ LIST PRODUCTS
 * Body:
 * {
 *   page: 1,
 *   limit: 10,
 *   search: "abc",
 *   includeInactive: false
 * }
 */
exports.productslist = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.body?.page || 1, 10), 1);
    const limit = Math.max(parseInt(req.body?.limit || 10, 10), 1);
    const skip = (page - 1) * limit;

    const search = toStr(req.body?.search);
    const includeInactive = Boolean(req.body?.includeInactive);

    const db = await connectToMongoDB();
    const collection = db.collection("tblproducts");

    const filter = {};

    // default: only active
    if (!includeInactive) {
      filter.IsDataStatus = true;
    }

    // optional search by name
    if (search) {
      filter.ProductName = { $regex: search, $options: "i" };
    }

    const items = await collection
      .find(filter)
      .sort({ CreatedDate: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const totalCount = await collection.countDocuments(filter);

    const updated = (items || []).map(mapProduct);

    sendResponse(res, "products found.", null, updated, totalCount);
  } catch (error) {
    console.error("Error in productslist:", error);
    next(error);
  }
};

/**
 * ✅ ADD PRODUCT
 * Body:
 * {
 *   ProductName: "Gold Plan",
 *   ProductAmount: 150,
 *   ProductTotalStar: 10,
 *   ProductImage: "gold.png",
 *   CreatedBy: "adminUserId"
 * }
 */
exports.productsadd = async (req, res, next) => {
  try {
    const ProductName = toStr(req.body?.ProductName);
    const ProductAmount = toAmount(req.body?.ProductAmount);

    // ✅ NEW FIELD
    const ProductTotalStar = toAmount(req.body?.ProductTotalStar);

    const ProductImage = toStr(req.body?.ProductImage);
    const CreatedBy = toStr(req.body?.CreatedBy);

    if (!ProductName) {
      return sendResponse(res, "ProductName is required.", true, [], 0);
    }

    const db = await connectToMongoDB();
    const collection = db.collection("tblproducts");

    const now = new Date();

    const doc = {
      ProductID: generateUniqueId(),
      ProductName,
      ProductAmount,

      // ✅ NEW FIELD
      ProductTotalStar,

      ProductImage,
      IsDataStatus: true,
      CreatedBy,
      CreatedDate: now,
      ModifyBy: "",
      ModifyDate: null,
    };

    await collection.insertOne(doc);

    sendResponse(res, "product added successfully.", null, mapProduct(doc), 1);
  } catch (error) {
    console.error("Error in productsadd:", error);
    next(error);
  }
};

/**
 * ✅ MODIFY PRODUCT
 * Body:
 * {
 *   ProductID: "xxxx",
 *   ProductName: "Updated Name",
 *   ProductAmount: 200,
 *   ProductTotalStar: 15,
 *   ProductImage: "new.png",
 *   ModifyBy: "adminUserId",
 *   IsDataStatus: true
 * }
 */
 exports.productsmodify = async (req, res, next) => {
  try {
    const ProductID = toStr(req.body?.ProductID)?.trim()
    console.log("ProductID:", `[${ProductID}]`)

    if (!ProductID) {
      return sendResponse(res, "ProductID is required.", true, [], 0)
    }

    const ProductName =
      req.body?.ProductName !== undefined ? toStr(req.body.ProductName) : undefined

    const ProductAmount =
      req.body?.ProductAmount !== undefined ? toAmount(req.body.ProductAmount) : undefined

    const ProductTotalStar =
      req.body?.ProductTotalStar !== undefined ? toAmount(req.body.ProductTotalStar) : undefined

    const ProductImage =
      req.body?.ProductImage !== undefined ? toStr(req.body.ProductImage) : undefined

    const IsDataStatus =
      req.body?.IsDataStatus !== undefined ? Boolean(req.body.IsDataStatus) : undefined

    const ModifyBy = toStr(req.body?.ModifyBy)
    const now = new Date()

    const db = await connectToMongoDB()
    const collection = db.collection("tblproducts")

    // ✅ Build $set safely
    const $set = {
      ModifyBy,
      ModifyDate: now,
    }

    if (ProductName !== undefined) $set.ProductName = ProductName
    if (ProductAmount !== undefined) $set.ProductAmount = ProductAmount
    if (ProductTotalStar !== undefined) $set.ProductTotalStar = ProductTotalStar
    if (ProductImage !== undefined) $set.ProductImage = ProductImage
    if (IsDataStatus !== undefined) $set.IsDataStatus = IsDataStatus

    // ✅ Update
    const upd = await collection.updateOne({ ProductID }, { $set })

    // ✅ This is the REAL "not found" check
    if (!upd?.matchedCount) {
      return sendResponse(res, "product not found.", true, [], 0)
    }

    // ✅ Return updated document
    const updatedDoc = await collection.findOne({ ProductID })
    sendResponse(res, "product updated successfully.", null, mapProduct(updatedDoc), 1)
  } catch (error) {
    console.error("Error in productsmodify:", error)
    next(error)
  }
}


 exports.productsdelete = async (req, res, next) => {
  try {
    const ProductID = toStr(req.body?.ProductID)?.trim()
    const ModifyBy = toStr(req.body?.ModifyBy)

    if (!ProductID) {
      return sendResponse(res, "ProductID is required.", true, [], 0)
    }

    const db = await connectToMongoDB()
    const collection = db.collection("tblproducts")

    const now = new Date()

    // ✅ Reliable update result (no false "not found")
    const upd = await collection.updateOne(
      { ProductID },
      {
        $set: {
          IsDataStatus: false,
          ModifyBy,
          ModifyDate: now,
        },
      }
    )

    // ✅ True "not found"
    if (!upd?.matchedCount) {
      return sendResponse(res, "product not found.", true, [], 0)
    }

    // ✅ Return updated doc
    const updatedDoc = await collection.findOne({ ProductID })
    sendResponse(res, "product deleted successfully.", null, mapProduct(updatedDoc), 1)
  } catch (error) {
    console.error("Error in productsdelete:", error)
    next(error)
  }
}

exports.productsview = async (req, res, next) => {
  try {
    const ProductID = toStr(req.body?.ProductID);
    if (!ProductID) {
      return sendResponse(res, "ProductID is required.", true, [], 0);
    }

    const db = await connectToMongoDB();
    const collection = db.collection("tblproducts");

    const doc = await collection.findOne({ ProductID });
    if (!doc) {
      return sendResponse(res, "product not found.", true, [], 0);
    }

    sendResponse(res, "product found.", null, mapProduct(doc), 1);
  } catch (error) {
    console.error("Error in productsview:", error);
    next(error);
  }
};
