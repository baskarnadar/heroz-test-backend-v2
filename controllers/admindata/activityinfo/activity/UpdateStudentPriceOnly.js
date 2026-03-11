const { connectToMongoDB } = require("../../../../database/mongodb");
const {
  generateUniqueId,
} = require("../../../../controllers/operation/operation");

const UpdateStudentPriceOnly = async ({
  db,
  SchoolStudentPrice,
  VendorID,
  ActivityID,
}) => {
  if (!Array.isArray(SchoolStudentPrice) || SchoolStudentPrice.length === 0) return;

  const collection = db.collection("tblactpriceinfo");
  console.log("SchoolStudentPrice");
  console.log(SchoolStudentPrice);

  try {
    for (const item of SchoolStudentPrice) {
      if (item.PriceID) {
        const filter = {
          ActivityID,
          VendorID,
          PriceID: item.PriceID,
        };

        const update = {
          $set: {
            SchoolPrice: item.SchoolPrice || "",
          },
        };

        await collection.updateOne(filter, update);
      }
    }
  } catch (error) {
    console.error("UpdatePrice Error:", error);
    throw error;
  }
};

module.exports = UpdateStudentPriceOnly;

module.exports = UpdateStudentPriceOnly;
