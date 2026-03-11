const { connectToMongoDB } = require("../../database/mongodb");
const { generateUniqueId } = require("../../controllers/operation/operation");
// Helper function to send responses
function sendResponse(res, message, error, results,totalCount) {
  res.status(error ? 400 : 200).json({
    'statusCode': error ? 400 : 200,
    'message': message,
    'data': results,
    'error': error,
    'totalCount':totalCount
  });
}

 exports.getnote = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const collection = db.collection("tblnotification");

    const { NoteID } = req.body;

    const filter = { NoteID };

    const pipeline = [
      { $match: filter },
      { $sort: { CreatedDate: -1 } },

      // Lookup from tblactivityinfo if noteType is 'ACTIVITY'
      {
        $lookup: {
          from: 'tblactivityinfo',
          let: { activityId: '$ActivityID', type: '$noteType' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$ActivityID', '$$activityId'] },
                    { $eq: ['$$type', 'ACTIVITY'] },
                  ],
                },
              },
            },
            {
              $project: {
                actStatus: 1,
                actName:1,
              },
            },
          ],
          as: 'activityInfo',
        },
      },

      // Lookup from tblvendorinfo
      {
        $lookup: {
          from: 'tblvendorinfo',
          localField: 'VendorID',
          foreignField: 'VendorID',
          as: 'vendorInfo',
        },
      },

      // Flatten embedded arrays (optional)
      {
        $addFields: {
          actStatus: { $arrayElemAt: ['$activityInfo.actStatus', 0] },
           actName: { $arrayElemAt: ['$activityInfo.actName', 0] },
          vdrName: { $arrayElemAt: ['$vendorInfo.vdrName', 0] },
          vdrClubName: { $arrayElemAt: ['$vendorInfo.vdrClubName', 0] },
        },
      },

      // Optionally remove the lookup arrays
      {
        $project: {
          activityInfo: 0,
          vendorInfo: 0,
        },
      },
    ];

    const note = await collection.aggregate(pipeline).toArray();
    const totalCount = await collection.countDocuments(filter);

    sendResponse(res, 'note found.', null, note, totalCount);
  } catch (error) {
    console.error('Error in getnote:', error);
    next(error);
  }
};

 exports.updateNote = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const collection = db.collection("tblnotification");

    const { NoteID } = req.body;
    if (!NoteID) {
      return res.status(400).json({ message: 'NoteID is required' });
    }

    const result = await collection.updateOne(
      { NoteID },
      { $set: { noteStatus: 'READ' } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Note not found' });
    }

    return res.status(200).json({ message: 'Note status updated to READ' });
  } catch (error) {
    console.error('Error updating note:', error);
    next(error);
  }
}; exports.getnoteList = async (req, res, next) => {
  try {
    const db = await connectToMongoDB()
    const collection = db.collection('tblnotification')

    // 🔍 1️⃣ Log raw payload
    console.log('▶️ getnoteList req.body:', JSON.stringify(req.body, null, 2))

    const { noteTo, VendorID } = req.body || {}

    // 🔍 2️⃣ Log extracted values
    console.log('▶️ noteTo:', noteTo)
    console.log('▶️ VendorID:', VendorID)

    // ✅ noteTo is required
    if (!noteTo) {
      return sendResponse(
        res,
        'noteTo is required.',
        {
          type: 'validation_error',
          field: 'noteTo',
          receivedBody: req.body, // 👈 already good
        },
        null,
      )
    }

    // ✅ Base filter
    const filter = { noteTo }

    // ✅ Optional Vendor filter
    if (VendorID && String(VendorID).trim() !== '') {
      filter.VendorID = VendorID
    }

    // 🔍 3️⃣ Log final MongoDB filter
    console.log('▶️ Mongo filter:', JSON.stringify(filter, null, 2))

    const pipeline = [
      { $match: filter },
      { $sort: { CreatedDate: -1 } },

      {
        $lookup: {
          from: 'tblactivityinfo',
          let: { activityId: '$ActivityID', type: '$noteType' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$ActivityID', '$$activityId'] },
                    { $eq: ['$$type', 'ACTIVITY'] },
                  ],
                },
              },
            },
            {
              $project: {
                actStatus: 1,
                actName: 1,
              },
            },
          ],
          as: 'activityInfo',
        },
      },

      {
        $lookup: {
          from: 'tblvendorinfo',
          localField: 'VendorID',
          foreignField: 'VendorID',
          as: 'vendorInfo',
        },
      },

      {
        $addFields: {
          actStatus: { $arrayElemAt: ['$activityInfo.actStatus', 0] },
          actName: { $arrayElemAt: ['$activityInfo.actName', 0] },
          vdrName: { $arrayElemAt: ['$vendorInfo.vdrName', 0] },
          vdrClubName: { $arrayElemAt: ['$vendorInfo.vdrClubName', 0] },
        },
      },

      {
        $project: {
          activityInfo: 0,
          vendorInfo: 0,
        },
      },
    ]

    // 🔍 4️⃣ Log pipeline
    console.log('▶️ Mongo pipeline:', JSON.stringify(pipeline, null, 2))

    const note = await collection.aggregate(pipeline).toArray()
    const totalCount = await collection.countDocuments(filter)

    // 🔍 5️⃣ Log results
    console.log('◀️ notes length:', note.length)
    console.log('◀️ totalCount:', totalCount)

    sendResponse(res, 'note found.', null, note, totalCount)
  } catch (error) {
    console.error('❌ Error in getnoteList:', error)
    next(error)
  }
}

exports.delNote = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const collection = db.collection("tblnotification");

    const { NoteID } = req.body;
    if (!NoteID) {
      return res.status(400).json({ message: 'NoteID is required' });
    }

    const result = await collection.deleteOne({ NoteID });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Note not found or already deleted' });
    }

    return res.status(200).json({ message: 'Note successfully deleted' });
  } catch (error) {
    console.error('Error deleting note:', error);
    next(error);
  }
};

const { ObjectId } = require("mongodb"); // Ensure this is imported at the top
 
 