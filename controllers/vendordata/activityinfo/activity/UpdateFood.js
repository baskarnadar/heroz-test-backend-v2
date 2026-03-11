const { connectToMongoDB } = require("../../../../database/mongodb");
const {
  generateUniqueId,
} = require("../../../../controllers/operation/operation");

const UpdateFood = async ({
  db,
  actFoodVal,
  VendorID,
  ActivityID,
  IsDataStatus,
  CreatedBy,
  ModifyBy,
}) => {
  if (!Array.isArray(actFoodVal) || actFoodVal.length === 0) return;
  console.log(actFoodVal);
  const collection = db.collection("tblactfoodinfo");

  try {
    for (const food of actFoodVal) {
      if (food.FoodID) {
        if (food.RemoveFood) {
          // Delete the record matching FoodID, VendorID, ActivityID
          await collection.deleteOne({
            FoodID: food.FoodID,
            VendorID,
            ActivityID,
          });
          continue; // Skip the update for this item
        }
        const filter = {
          FoodID: food.FoodID,
          VendorID,
          ActivityID,
        };

        const update = {
          $set: {
            FoodName: food.FoodName || "",
            
            FoodPrice: food.FoodPrice || "0",
            FoodPriceVatPercentage: food.FoodPriceVatPercentage, // ✅ VAT %
            FoodPriceVatAmount: food.FoodPriceVatAmount, 

            FoodHerozPrice: food.FoodHerozPrice || "0",
            FoodHerozPriceVatAmount: food.FoodHerozPriceVatAmount || "0",

            FoodSchoolPrice: food.FoodSchoolPrice || "0",
            FoodSchoolPriceVatAmount: food.FoodSchoolPriceVatAmount || "0",

            FoodNotes: food.FoodNotes || "",
            FoodImage: food.FoodImage || "",
            Include: food.Include || false,
            IsDataStatus: IsDataStatus || 1,
            ModifyDate: new Date(),
            ModifyBy: ModifyBy || null,
          },
        };

        await collection.updateOne(filter, update);
      } else {
        // Insert new food
        const newFood = {
          FoodID: generateUniqueId(), // Generate unique FoodID
          VendorID,
          ActivityID,
          FoodName: food.FoodName || "",
          FoodPrice: food.FoodPrice || "0",
          FoodSchoolPrice: food.FoodSchoolPrice || "0",
          FoodHerozPrice: food.FoodHerozPrice || "0",
          FoodNotes: food.FoodNotes || "",
          FoodImage: food.FoodImage || "",
          Include: food.Include || false,
          IsDataStatus: IsDataStatus || 1,
          CreatedDate: new Date(),
          CreatedBy: CreatedBy || null,
          ModifyDate: new Date(),
          ModifyBy: ModifyBy || null,
        };

        await collection.insertOne(newFood);
      }
    }
  } catch (error) {
    console.error("UpdateFood Error:", error);
    throw error;
  }
};

module.exports = UpdateFood;
