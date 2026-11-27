# Tuition

An iPhone app (Expo / React Native) for tracking tuition classes and fees: students with parents and subjects, scheduling with overlap warnings and group classes, class reminders, prepaid fee balances that drop as classes are completed, and monthly class counts with carry-over.

## Run on an iPhone
```
npm install
npx expo prebuild --platform ios
cd ios && pod install && cd ..
./reinstall-ios.sh   # builds the Release app and installs it on the connected iPhone
```
Data is stored only on the phone.
