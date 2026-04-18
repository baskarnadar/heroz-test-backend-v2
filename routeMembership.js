// routeMembership.js
const express = require('express')
const router = express.Router()
 

// Activity
const activitylistRoute = require('./controllers/membership/activity/activity.route')

// Profile
const profileRoute = require('./controllers/membership/profile/profile.route')

// review
const reviewRoute = require('./controllers/membership/review/review.route')

// Booking
const bookingRoute = require('./controllers/membership/booking/booking.route')

// ✅ Wallet
const walletRoute = require('./controllers/membership/wallet/wallet.route')

// ✅ Purchase (NEW)
const purchaseRoute = require('./controllers/membership/purchase/purchase.route')

// ✅ MemPayment (NEW)
const mempaymentRoute = require('./controllers/membership/mempayment/mempayment.route')

// ✅ Anonymous Misc
const anonMiscRoute = require('./controllers/membership/anonymous/misc/misc.route')

// ✅ Login
const memloginRoute = require('./controllers/membership/login/login.route')

// ✅ Favourite
const favRoute = require('./controllers/membership/fav/fav.route')

// ✅ Notification
const noteRoute = require('./controllers/membership/notification/note.route')


// Mount routes
router.use('/membership/activity', activitylistRoute)
router.use('/membership/profile', profileRoute)
router.use('/membership/review', reviewRoute)
router.use('/membership/booking', bookingRoute)

// ✅ Mount wallet route
router.use('/membership/wallet', walletRoute)

// ✅ Mount purchase route
router.use('/membership/purchase', purchaseRoute)

// ✅ Mount mempayment route
router.use('/membership/mempayment', mempaymentRoute)

// Anonymous
router.use('/membership/anonymous/misc', anonMiscRoute)

// ✅ Mount login route
router.use('/membership/login', memloginRoute)

// ✅ Mount favourite route
router.use('/membership/fav', favRoute)

// ✅ Mount notification route
router.use('/membership/notification', noteRoute)

module.exports = router
