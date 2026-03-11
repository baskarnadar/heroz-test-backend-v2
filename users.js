// users.js - simple in-memory token store
const users = {};

function saveTokensForUser(userId, tokens) {
  users[userId] = { tokens };
}

function findUserById(userId) {
  return users[userId];
}

function updateTokensForUser(userId, newTokens) {
  if (!users[userId]) return;
  users[userId].tokens = { ...users[userId].tokens, ...newTokens };
}

module.exports = { saveTokensForUser, findUserById, updateTokensForUser };
