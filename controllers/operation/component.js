const { v4: uuidv4 } = require("uuid");
const { connectToMongoDB } = require("../../database/mongodb");
const {
  generateUniqueId,
} = require("../../controllers/operation/operation");
const InsertNotification = async ({
  db,
  RequestID,
  VendorID,
  ActivityID,
  SchoolID,
  noteType,
  noteFrom,
  noteTo,
  IsDataStatus,
  CreatedBy,
  ModifyBy,
  noteKeyWord,
  noteStatus
  
}) => {
  const collection = db.collection("tblnotification");

  const docToInsert = {
    NoteID: generateUniqueId(),
    RequestID,
    VendorID,
    noteKeyWord,
    ActivityID,
    SchoolID: SchoolID || null,
    noteType: noteType || null,
    noteFrom: noteFrom || null,
    noteTo: noteTo || null,
    noteStatus: "NEW",
    IsDataStatus: IsDataStatus || 1,
    CreatedDate: new Date(),
    CreatedBy: CreatedBy || null,
    ModifyDate: new Date(),
    ModifyBy: ModifyBy || null, 
  };
  try {
    await collection.insertOne(docToInsert);
  } catch (error) {
    console.error("InsertNotification Error:", error);
    throw error;
  }
};


module.exports = { InsertNotification };
