const { connectToMongoDB } = require("../../../../database/mongodb");
const {
  generateUniqueId,
} = require("../../../../controllers/operation/operation");

const UpdateDaysHours = async ({
  db,
  availData,
  VendorID,
  ActivityID,
  IsDataStatus,
  CreatedBy,
  ModifyBy,
}) => {
  if (!availData || !availData.rows || !Array.isArray(availData.rows)) return;

  const collection = db.collection("tblactavaildayshours");

  try {
    for (const item of availData.rows) {
      
      if (item.RemoveDays) {
        await collection.deleteOne({
          AvailDaysHoursID: item.AvailDaysHoursID,
          VendorID,
          ActivityID,
        });
        continue; // Skip to next item
      }

      if (item.AvailDaysHoursID) {
        // Update existing record
        const filter = {
          AvailDaysHoursID: item.AvailDaysHoursID,
          VendorID,
          ActivityID,
        };

        const update = {
          $set: {
            DayName: item.DayName || "",
            StartTime: item.StartTime || "",
            EndTime: item.EndTime || "",
            Note: item.Note || "",
            Total: item.Total || "0.00",
            IsDataStatus: IsDataStatus || 1,
            ModifyDate: new Date(),
            ModifyBy: ModifyBy || null,
          },
        };

        await collection.updateOne(filter, update);
      } else {
        // Insert new record
        const newAvailDaysHours = {
          AvailDaysHoursID: generateUniqueId(),
          VendorID,
          ActivityID,
          DayName: item.DayName || "",
          StartTime: item.StartTime || "",
          EndTime: item.EndTime || "",
          Note: item.Note || "",
          Total: item.Total || "0.00",
          IsDataStatus: IsDataStatus || 1,
          CreatedDate: new Date(),
          CreatedBy: CreatedBy || null,
          ModifyDate: new Date(),
          ModifyBy: ModifyBy || null,
        };

        await collection.insertOne(newAvailDaysHours);
      }
    }
  } catch (error) {
    console.error("UpdateDaysHours Error:", error);
    throw error;
  }
};

module.exports = UpdateDaysHours;
