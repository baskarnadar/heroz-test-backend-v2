const { connectToMongoDB } = require("../../../../database/mongodb");
const { createUser, updatepassword } = require("../../../service/userService");
const {
  generateUniqueId,
  generateactivityNo,
} = require("../../../../controllers/operation/operation");

const InsertPrice = async ({
  db,
  priceList,
  VendorID,
  ActivityID,
  IsDataStatus,
  CreatedBy,
  ModifyBy,
}) => {
  if (!Array.isArray(priceList) || priceList.length === 0) return;

  const collection = db.collection("tblactpriceinfo");

  const docsToInsert = priceList.map((item) => ({
    PriceID: generateUniqueId(),
    VendorID,
    ActivityID,
    Price: item.Price || "0",
    SchoolPrice: item.SchoolPrice || "",
    HerozStudentPrice: item.HerozStudentPrice || "",
    StudentRangeFrom: item.StudentRangeFrom || "",
    StudentRangeTo: item.StudentRangeTo || "",
    IsDataStatus: IsDataStatus || 1,
    CreatedDate: new Date(),
    CreatedBy: CreatedBy || null,
    ModifyDate: new Date(),
    ModifyBy: ModifyBy || null,
  }));

  try {
    await collection.insertMany(docsToInsert);
  } catch (error) {
    console.error("InsertPrice Error:", error);
    throw error;
  }
};

module.exports = InsertPrice;
