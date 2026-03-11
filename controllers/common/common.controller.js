const { connectToMongoDB } = require("../../database/mongodb");

// Helper function to send responses
function sendResponse(res, message, error, results) {
  res.status(error ? 400 : 200).json({
    'statusCode': error ? 400 : 200,
    'message': message,
    'data': results,
    'error': error,
  });
}
 
 exports.totnote = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();

    const { noteTo, VendorID } = req.body || {};

    // ✅ Base filter (required)
    const filter = {
      noteTo,
      noteStatus: 'NEW',
    };

    // ✅ Optional VendorID filter (only if provided + not empty)
    if (VendorID && String(VendorID).trim() !== '') {
      filter.VendorID = VendorID;
    }

    const totalCount = await db.collection('tblnotification').countDocuments(filter);

    sendResponse(res, "Total new notifications fetched successfully.", null, {
      totalCount,
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
};


 exports.IsUserExist = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const { username } = req.body;
console.log(username);
    // Check if user exists in tblprtusers
    const user = await db.collection('tblprtusers').findOne({ username });

    if (user) {
      return sendResponse(res, "User exists.", null, { exists: true });
    } else {
      return sendResponse(res, "User not found.", null, { exists: false });
    }
  } catch (error) {
    console.error("Error in IsUserExist:", error);
    next(error);
  }
};

 // Checks if username exists in tblprtusers AND/OR email exists in tblvendorinfo
exports.VdrIsUserEmailExist = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const { username, vdrEmailAddress } = req.body || {};

    // small helper to escape regex metachars
    const escapeRegex = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const trimmedUsername = (username ?? "").toString().trim();
    const normalizedEmail = (vdrEmailAddress ?? "").toString().trim();

    const result = {
      usernameExists: false,
      emailExists: false,
    };

    // Username check (exact match)
    if (trimmedUsername) {
      const user = await db
        .collection("tblprtusers")
        .findOne({ username: trimmedUsername });
      result.usernameExists = !!user;
    }

    // Email check (case-insensitive exact match) in tblvendorinfo
    if (normalizedEmail) {
      const vendor = await db
        .collection("tblvendorinfo")
        .findOne(
          { vdrEmailAddress: { $regex: `^${escapeRegex(normalizedEmail)}$`, $options: "i" } }
        );
      result.emailExists = !!vendor;
    }

    // If you only want to check email and ignore username, you can just return result.emailExists
    return sendResponse(res, "Lookup complete.", null, result);
  } catch (error) {
    console.error("Error in VdeIsUserEmailExist:", error);
    next(error);
  }
};

exports.SchIsUserEmailExist = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const { username, schEmailAddress } = req.body || {};

    // small helper to escape regex metachars
    const escapeRegex = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const trimmedUsername = (username ?? "").toString().trim();
    const normalizedEmail = (schEmailAddress ?? "").toString().trim();

    const result = {
      usernameExists: false,
      emailExists: false,
    };

    // Username check (exact match)
    if (trimmedUsername) {
      const user = await db
        .collection("tblprtusers")
        .findOne({ username: trimmedUsername });
      result.usernameExists = !!user;
    }

    // Email check (case-insensitive exact match) in tblschoolinfo
    if (normalizedEmail) {
      const school = await db
        .collection("tblschoolinfo")
        .findOne(
          { schEmailAddress: { $regex: `^${escapeRegex(normalizedEmail)}$`, $options: "i" } }
        );
      result.emailExists = !!school;
    }

    // If you only want to check email and ignore username, you can just return result.emailExists
    return sendResponse(res, "Lookup complete.", null, result);
  } catch (error) {
    console.error("Error in VdeIsUserEmailExist:", error);
    next(error);
  }
};
