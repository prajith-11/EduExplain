export type UserRole = 'faculty' | 'student';

export interface User {
  uid: string;
  email: string;
  role: UserRole;
  displayName?: string;
  rollNumber?: string;
  facultyId?: string;
}

export interface StudentData {
  sex: 'M' | 'F';
  age: number;
  traveltime: number;
  studytime: number;
  activities: boolean;
  failures: number;
  internet: boolean;
  health: number;
  absences: number;
  goout: number;
  freetime: number;
  Mid1: number;
  Mid2: number;
}

export interface PredictionResult {
  predictedGrade: number;
  gradeClass: 'A' | 'B' | 'C' | 'D' | 'F';
  confidence?: number;
  explanation: string;
  featureImportance: { feature: string; importance: number }[];
  recommendations: string[];
}
