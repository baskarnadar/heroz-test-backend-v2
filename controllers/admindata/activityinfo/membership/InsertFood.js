const { connectToMongoDB } = require("../../../../database/mongodb");
const { createUser, updatepassword } = require("../../../service/userService");
const {
  generateUniqueId,
  generateactivityNo,
} = require("../../../../controllers/operation/operation");
const InsertFood = async ({
  db,
  actFoodVal,
  VendorID,
  ActivityID,
  IsDataStatus,
  CreatedBy,
  ModifyBy,
}) => {
  if (!Array.isArray(actFoodVal) || actFoodVal.length === 0) return;

  const collection = db.collection("tblactfoodinfo");

  const docsToInsert = actFoodVal.map((food) => ({
    FoodID: generateUniqueId(),
    VendorID,
    ActivityID,
    FoodName: food.FoodName || "",
    FoodPrice: food.FoodPrice || "0",
    FoodHerozPrice: food.FoodHerozPrice || "0",
    FoodSchoolPrice: food.FoodSchoolPrice || "0",
    FoodNotes: food.FoodNotes || "",
    FoodImage: food.FoodImage || "",
    Include: food.Include || false,
    IsDataStatus: IsDataStatus || 1,
    CreatedDate: new Date(),
    CreatedBy: CreatedBy || null,
    ModifyDate: new Date(),
    ModifyBy: ModifyBy || null,
  }));

  try {
    await collection.insertMany(docsToInsert);
  } catch (error) {
    console.error("InsertFood Error:", error);
    throw error;
  }
};

module.exports = InsertFood;
