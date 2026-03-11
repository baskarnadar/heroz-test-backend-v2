const { connectToMongoDB } = require("../../../../database/mongodb");
const { createUser, updatepassword } = require("../../../service/userService");
const {
  generateUniqueId,
  generateactivityNo,
} = require("../../../../controllers/operation/operation");
const InsertDaysHours = async ({
  db,
  availData,
  VendorID,
  ActivityID,
  IsDataStatus,
  CreatedBy,
  ModifyBy,
}) => {
  if (!availData || !availData.rows || !Array.isArray(availData.rows)) return;

  const collection = db.collection('tblactavaildayshours');

  const docsToInsert = availData.rows.map((item) => ({
    AvailDaysHoursID:generateUniqueId(),
    VendorID,
    ActivityID,
    DayName: item.DayName || '',
    StartTime: item.StartTime || '',
    EndTime: item.EndTime || '',
    Note: item.Note || '',
    Total: item.Total || '0.00',
    IsDataStatus: IsDataStatus || 1,
    CreatedDate: new Date(),
    CreatedBy: CreatedBy || null,
    ModifyDate: new Date(),
    ModifyBy: ModifyBy || null,
  }));

  try {
    await collection.insertMany(docsToInsert);
  } catch (error) {
    console.error('InsertAvailability Error:', error);
    throw error;
  }
};

module.exports = InsertDaysHours;
