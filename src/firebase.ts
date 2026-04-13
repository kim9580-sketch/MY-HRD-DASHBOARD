import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Firebase 앱 초기화
// initializeApp 함수는 설정 객체를 받아 Firebase 서비스를 시작합니다.
const app = initializeApp(firebaseConfig);

// Firestore 데이터베이스 인스턴스 가져오기
// firebaseConfig에 정의된 firestoreDatabaseId를 사용하여 특정 데이터베이스에 연결합니다.
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Firebase 인증 서비스 가져오기
export const auth = getAuth(app);
