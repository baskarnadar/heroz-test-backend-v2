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

 

const { ObjectId } = require("mongodb"); // Ensure this is imported at the top
 
 
 
function sendResponse(res, message, error = null, data = null) {
  const code = res.statusCode || (error ? 400 : 200)
  // avoid sending giant error objects
  const safeError =
    error && typeof error === 'object'
      ? (error.message || 'Error')
      : error ?? null

  return res.status(code).json({
    statusCode: code,
    message,
    data,
    error: safeError,
  })
}

 exports.ptrsPaySignin = async (req, res, next) => {
  const jwt = require('jsonwebtoken')

  const SECRET = process.env.JWT_SECRET
  if (!SECRET) {
    console.warn('[auth] JWT_SECRET is not set. Set it in your environment!')
  }

  // Normalize mobile input
  const rawMobile = String(req.body?.ParentsMobileNo || '').trim()
  if (!rawMobile) {
    return sendResponse(res, 'ParentsMobileNo is required.', null, null, 400)
  }

  const onlyDigitsPlus = (s) => (s || '').replace(/[^\d+]/g, '')
  const normalizedMobile = onlyDigitsPlus(rawMobile).replace(/^\+/, '') // strip leading '+'

  if (normalizedMobile.length < 9 || normalizedMobile.length > 12) {
    return sendResponse(res, 'Invalid ParentsMobileNo format.', null, null, 400)
  }

  try {
    const db = await connectToMongoDB()
    const parentsCol = db.collection('tblBookTripParentsInfo')

    // Find an APPROVED mobile row (most recent first)
    const match = {
      ParentsMobileNo: normalizedMobile,
      status: 'APPROVED',
    }

    const parentRow = await parentsCol
      .find(match)
      .sort({ lastImportedAt: -1, createdAt: -1, _id: -1 })
      .limit(1)
      .next()

    if (!parentRow) {
      // Not found => statusCode 400
      return res.status(400).json({
        statusCode: 400,
        message: 'Mobile not authorized. No APPROVED record found.',
        data: null,
        error: null,
      })
    }

    // Use ParentsPayID as principal id
    const ParentsPayID = parentRow?.ParentsPayID ? String(parentRow.ParentsPayID) : ''
    if (!ParentsPayID) {
      return sendResponse(
        res,
        'APPROVED record found, but ParentsPayID is missing.',
        null,
        null,
        400
      )
    }

    // Create token
    const token = jwt.sign(
      {
        ParentsPayID,
        sub: ParentsPayID,
      },
      SECRET,
      {
        issuer: 'heroz-auth',
        audience: 'heroz-clients',
        algorithm: 'HS256',
      }
    )

     var ProfileImageName="https://dev-heroz-assets.s3.me-central-1.amazonaws.com/funtrip/logo.png";
    const userWithToken = {
      ParentsPayID,
      token,
      authSource: 'MOBILE_APPROVAL',
       ProfileImageName : ProfileImageName,
      ParentsMobileNo: normalizedMobile,
      approvedStatus: parentRow?.status || 'APPROVED',
      approvedAt: parentRow?.lastImportedAt || parentRow?.createdAt || null,
    }

    return sendResponse(res, 'Login successful', null, userWithToken, 200)
  } catch (error) {
    console.error('Login error (mobile approval):', error)
    return next(error)
  }
}


 exports.ptrsPayTripList = async (req, res) => {
  try {
    // 1) Validate TripNo (actRequestRefNo)
    const tripNo = (req.body?.TripNo || '').toString().trim();
    if (!tripNo) {
      return sendResponse(res, 'TripNo is required', true, null, 400);
    }

    const db = await connectToMongoDB();

    // We start from tblactivityrequest because TripNo is here
    const actReqCol = db.collection('tblactivityrequest');

    const pipeline = [
      {
        $match: {
          actRequestRefNo: tripNo,
          // ✅ handle the dot issue
          actRequestStatus: { $in: ['TRIP-BOOKED', 'TRIP-BOOKED.'] },
        },
      },

      // Join parent mobile rows by RequestID (optional)
      {
        $lookup: {
          from: 'tblBookTripParentsInfo',
          let: { reqID: '$RequestID' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$RequestID', '$$reqID'] },
              },
            },
          ],
          as: 'parentRows',
        },
      },

      // Join activity info
      {
        $lookup: {
          from: 'tblactivityinfo',
          localField: 'ActivityID',
          foreignField: 'ActivityID',
          as: 'activityInfo',
        },
      },
      { $unwind: { path: '$activityInfo', preserveNullAndEmptyArrays: true } },

      // ✅ Join categories (activityInfo.actCategoryID[] -> tbllokcategory.CategoryID)
      {
        $lookup: {
          from: 'tbllokcategory',
          let: {
            actCatIds: {
              $cond: [
                { $isArray: '$activityInfo.actCategoryID' },
                '$activityInfo.actCategoryID',
                [],
              ],
            },
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $in: [
                    '$CategoryID',
                    {
                      $map: {
                        input: '$$actCatIds',
                        as: 'cid',
                        in: { $toString: '$$cid' },
                      },
                    },
                  ],
                },
              },
            },
            {
              $project: {
                _id: 0,
                CategoryID: 1,
                EnCategoryName: 1,
                ArCategoryName: 1,
              },
            },
          ],
          as: 'categories',
        },
      },

      // Join school info
      {
        $lookup: {
          from: 'tblschoolinfo',
          localField: 'SchoolID',
          foreignField: 'SchoolID',
          as: 'schoolInfo',
        },
      },
      { $unwind: { path: '$schoolInfo', preserveNullAndEmptyArrays: true } },

      // Join vendor info
      {
        $lookup: {
          from: 'tblvendorinfo',
          localField: 'VendorID',
          foreignField: 'VendorID',
          as: 'vendorInfo',
        },
      },
      { $unwind: { path: '$vendorInfo', preserveNullAndEmptyArrays: true } },

      {
        $project: {
          _id: 1,

          RequestID: 1,
          ActivityID: 1,
          VendorID: 1,
          SchoolID: 1,

          actRequestRefNo: 1,
          actRequestDate: 1,
          actRequestTime: 1,
          actRequestStatus: 1,

          // parent rows (can be multiple)
          parentRows: 1,

          // Activity
          actName: '$activityInfo.actName',
          actDesc: '$activityInfo.actDesc',
          actImageName1: '$activityInfo.actImageName1',
          actImageName2: '$activityInfo.actImageName2',
          actImageName3: '$activityInfo.actImageName3',
          actGoogleMap: '$activityInfo.actGoogleMap',
          actAddress1: '$activityInfo.actAddress1',

          // ✅ keep raw actCategoryID array
          actCategoryID: {
            $cond: [
              { $isArray: '$activityInfo.actCategoryID' },
              '$activityInfo.actCategoryID',
              [],
            ],
          },

          // ✅ categories lookup result (EnCategoryName/ArCategoryName)
          categories: 1,

          // School
          schName: '$schoolInfo.schName',
          schImageName: '$schoolInfo.schImageName',

          // Vendor
          vdrName: '$vendorInfo.vdrName',
          vdrImageName: '$vendorInfo.vdrImageName',
        },
      },

      // If you have CreatedDate in tblactivityrequest, keep it; otherwise remove this sort.
      { $sort: { CreatedDate: -1 } },
    ];

    let rows = await actReqCol.aggregate(pipeline).toArray();

    // 4) Attach image URLs
    const BASE_ACTIVITY_URL =
      process.env.ActivityImageUrl || process.env.ACTIVITY_IMAGE_URL || '';
    const BASE_SCHOOL_URL =
      process.env.SchoolImageUrl || process.env.SCHOOL_IMAGE_URL || '';
    const BASE_VENDOR_URL =
      process.env.VendorImageUrl || process.env.VENDOR_IMAGE_URL || '';

    const withSlash = (u) => (u && !u.endsWith('/') ? u + '/' : u);
    const makeUrl = (base, name) => {
      if (!name || !base) return null;
      return withSlash(base) + String(name).replace(/^\/+/, '');
    };

    rows = rows.map((r) => {
      const actImageUrl1 = makeUrl(BASE_ACTIVITY_URL, r.actImageName1);
      const actImageUrl2 = makeUrl(BASE_ACTIVITY_URL, r.actImageName2);
      const actImageUrl3 = makeUrl(BASE_ACTIVITY_URL, r.actImageName3);
      const actImageUrls = [actImageUrl1, actImageUrl2, actImageUrl3].filter(Boolean);

      const schImageNameUrl = makeUrl(BASE_SCHOOL_URL, r.schImageName);
      const vdrImageNameUrl = makeUrl(BASE_VENDOR_URL, r.vdrImageName);

      // ✅ normalize categories (ensure array, remove nulls)
      const categories = Array.isArray(r.categories) ? r.categories.filter(Boolean) : [];

      return {
        ...r,
        actImageUrl1,
        actImageUrl2,
        actImageUrl3,
        actImageUrls,
        schImageNameUrl,
        vdrImageNameUrl,
        categories,
      };
    });

    return sendResponse(
      res,
      'OK',
      false,
      {
        TripNo: tripNo,
        count: rows.length,
        rows,
      },
      200
    );
  } catch (err) {
    console.error('ptrsPayTripList error:', err);
    return sendResponse(res, 'Server error', true, null, 500);
  }
};
