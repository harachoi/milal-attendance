export type TeamId =
  | "sarang"
  | "mideum"
  | "innae"
  | "younggwang"
  | "soman";

export type Role = "youth" | "teacher";

export interface Member {
  id: string;
  name: string;
  bold?: boolean;
}

export interface Team {
  id: TeamId;
  name: string;
  color: string;
  youth: Member[];
  teachers: Member[];
}

export interface ExtraPerson {
  id: string;
  name: string;
}

/** 한 날짜에 해당하는 출석 기록 (체크 표시 + 헌금 + 메모) */
export interface DayRecord {
  presentIds: Record<string, true>;
  ministersPresent: Record<string, true>;
  volunteerTeachersPresent: Record<string, true>;
  observersPresent: Record<string, true>;
  offering: number;
  notes: {
    teacherCounts?: string;
    newcomers?: string;
  };
}

/** 전역 상태: 명단(공용) + 날짜별 기록 */
export interface AttendanceState {
  date: string; // 현재 보고 있는 날짜 (YYYY-MM-DD)
  teams: Team[];
  ministers: ExtraPerson[];
  volunteerTeachers: ExtraPerson[];
  observers: ExtraPerson[];
  records: Record<string, DayRecord>; // 날짜 -> 기록
}

export const emptyDayRecord = (): DayRecord => ({
  presentIds: {},
  ministersPresent: {},
  volunteerTeachersPresent: {},
  observersPresent: {},
  offering: 0,
  notes: {},
});
