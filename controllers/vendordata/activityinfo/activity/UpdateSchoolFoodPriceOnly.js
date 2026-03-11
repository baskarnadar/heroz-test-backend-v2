const { connectToMongoDB } = require("../../../../database/mongodb");
const {
  generateUniqueId,
} = require("../../../../controllers/operation/operation");

 const UpdateSchoolFoodPriceOnly = async ({
  db,
  SchoolFoodPrice,
  VendorID,
  ActivityID,
}) => {
  if (!Array.isArray(SchoolFoodPrice) || SchoolFoodPrice.length === 0) return;
 
  const collection = db.collection("tblactfoodinfo");

  try {
    for (const food of SchoolFoodPrice) {
      if (food.FoodID) {
        const filter = {
          FoodID: food.FoodID,
          VendorID,
          ActivityID,
        };

        const update = {
          $set: {
            FoodSchoolPrice: food.CollectFoodSchoolPrice || "0",
          },
        };

        // Update if exists, otherwise insert
        await collection.updateOne(filter, update, { upsert: true });
      }
    }
  } catch (error) {
    console.error("UpdateSchoolFoodPriceOnly Error:", error);
    throw error;
  }
};


module.exports = UpdateSchoolFoodPriceOnly;
