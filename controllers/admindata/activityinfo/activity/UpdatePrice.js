const { connectToMongoDB } = require("../../../../database/mongodb");
const {
  generateUniqueId,
} = require("../../../../controllers/operation/operation");

const UpdatePrice = async ({
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
  console.log("priceList");
  console.log(priceList);
  try {
    for (const item of priceList) {
      if (item.PriceID) {
        if (item.RemovePrice) {
          // Delete the record matching PriceID, ActivityID, VendorID
          await collection.deleteOne({
            PriceID: item.PriceID,
            ActivityID,
            VendorID,
          });
          continue; // Skip the rest of the loop for this item
        }
        // Update existing price entry
        const filter = {
          ActivityID,
          VendorID,
          PriceID: item.PriceID,
        };

        const update = {
          $set: {
            Price: item.Price || "0",
             SchoolPrice: item.SchoolPrice || "",
            HerozStudentPrice: item.HerozStudentPrice || "",
            StudentRangeFrom: item.StudentRangeFrom || "",
            StudentRangeTo: item.StudentRangeTo || "",
            IsDataStatus: IsDataStatus || 1,
            ModifyDate: new Date(),
            ModifyBy: ModifyBy || null,
          },
        };

        await collection.updateOne(filter, update);
      } else {
        // Insert new price entry
        const newPriceEntry = {
          PriceID: generateUniqueId(), // generate new unique PriceID
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
        };

        await collection.insertOne(newPriceEntry);
      }
    }
  } catch (error) {
    console.error("UpdatePrice Error:", error);
    throw error;
  }
};

module.exports = UpdatePrice;
