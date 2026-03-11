// routeMembership.js
const express = require('express')
const router = express.Router()

// Activity
const activitylistRoute = require('./controllers/membership/activity/activity.route')

// Profile
const profileRoute = require('./controllers/membership/profile/profile.route')

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

// Mount routes
router.use('/membership/activity', activitylistRoute)
router.use('/membership/profile', profileRoute)
router.use('/membership/booking', bookingRoute)

// ✅ Mount wallet route
router.use('/membership/wallet', walletRoute)

// ✅ Mount purchase route
router.use('/membership/purchase', purchaseRoute)

// ✅ Mount mempayment route
router.use('/membership/mempayment', mempaymentRoute)

// Anonymous
router.use('/membership/anonymous/misc', anonMiscRoute)

module.exports = router
