# Mock MWA Wallet Setup & Troubleshooting Guide

## 🚨 **Critical Steps for Mock MWA Wallet Authentication**

### **1. Initial Setup**
1. **Install Mock MWA Wallet** on your Android device/emulator
2. **Open the Mock MWA Wallet app**
3. **Press the "Authenticate" button** (THIS IS CRITICAL!)
   - Authentication is only valid for **15 minutes**
   - You must re-authenticate every 15 minutes
4. **Complete biometric authentication** when prompted

### **2. Biometric Setup on Emulator**
If using an Android emulator:
1. Open **Settings** app on emulator
2. Search for **"Fingerprint"** or **"Pin Code"** settings
3. Follow setup instructions to add fingerprint/PIN
4. Test that biometric authentication works

### **3. Common Error: "authorization request declined"**

This error occurs when:
- ❌ Mock MWA Wallet is not authenticated (most common)
- ❌ Authentication expired (after 15 minutes)
- ❌ Biometric verification was declined/failed
- ❌ Wallet app closed during authentication

**Solution:**
1. Open Mock MWA Wallet
2. Press "Authenticate" button
3. Complete biometric verification
4. Try connecting from your app again

### **4. Testing Your App Connection**

1. **Install Mock MWA Wallet** ✅
2. **Authenticate in wallet** (15 min validity) ✅
3. **Open your Momentum Racing app** ✅
4. **Tap "Launch Into Racing"** ✅
5. **Complete biometric verification when prompted** ✅

### **5. Debugging Tips**

Check React Native logs for these messages:
```
🔐 Starting MWA authorization...
✅ MWA authorization successful
```

If you see:
```
❌ MWA authorization failed: authorization request declined
```

**Action:** Re-authenticate in Mock MWA Wallet!

### **6. Authentication Flow**

```
Your App → Mock MWA Wallet → Biometric Check → Authorization → Success
```

**Each step must succeed for connection to work!**

### **7. Troubleshooting Checklist**

- [ ] Mock MWA Wallet installed
- [ ] Pressed "Authenticate" in wallet (< 15 min ago)
- [ ] Biometric authentication set up on device/emulator
- [ ] Wallet app running in background
- [ ] No interference from other wallet apps
- [ ] Device has sufficient permissions

### **8. Re-Authentication Required**

You'll need to re-authenticate in Mock MWA Wallet:
- Every 15 minutes
- After device restart
- After wallet app force-close
- If authentication fails

### **9. Expected Behavior**

**Successful flow:**
1. Tap "Launch Into Racing"
2. Mock MWA Wallet opens/comes to foreground
3. Biometric prompt appears
4. After verification → back to your app
5. Connection successful ✅

**Failed flow:**
1. Tap "Launch Into Racing"
2. Error message appears immediately
3. No wallet interaction
4. "authorization request declined" error ❌

## 🔧 **If Still Having Issues**

1. **Uninstall and reinstall** Mock MWA Wallet
2. **Clear device biometric data** and re-set up
3. **Restart Android device/emulator**
4. **Check device logs** for additional error details
5. **Verify app permissions** in device settings

## ⚠️ **Important Notes**

- Mock MWA Wallet is **TESTING ONLY** - don't use with real funds
- Authentication expires every **15 minutes**
- Biometric setup is **required** for authentication
- One authentication session works for **multiple app connections**
- Always check wallet authentication status **before testing** 