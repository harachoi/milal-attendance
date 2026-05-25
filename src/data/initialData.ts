import type { AttendanceState, DayRecord, Member, Team } from "../types";
import { emptyDayRecord } from "../types";

let _id = 0;
const m = (name: string, bold = false): Member => ({
  id: `m_${_id++}_${name}`,
  name,
  bold,
});

// 인내조는 첫 번째 사진에서 정확히 읽어 옮긴 명단입니다.
// 다른 조는 두 번째 사진에서 최대한 읽어 옮겼습니다.
// 부정확한 이름이 있을 수 있으니 앱 안의 "명단 편집"에서 자유롭게 수정하세요.
export const INITIAL_TEAMS: Team[] = [
  {
    id: "sarang",
    name: "사랑조",
    color: "#FFF4D6",
    youth: [
      m("조융우"),
      m("정은혁"),
      m("송원유"),
      m("여태민"),
      m("서성민"),
      m("김정우"),
      m("김미안"),
      m("이승준"),
      m("이경석"),
      m("임승원"),
      m("이효림"),
      m("김정찬"),
      m("최서아"),
      m("김규애"),
      m("김찬영"),
    ],
    teachers: [
      m("안제영", true),
      m("구선희"),
      m("윤선택"),
      m("구승섭"),
      m("윤수진"),
      m("김명희"),
      m("박명권"),
      m("전정숙"),
      m("조혜숙"),
      m("정남기"),
      m("정승영"),
      m("김희영"),
      m("유재현"),
    ],
  },
  {
    id: "mideum",
    name: "믿음조",
    color: "#FFE0E9",
    youth: [
      m("김하연"),
      m("김원원"),
      m("임동현"),
      m("강민주"),
      m("이규섭"),
      m("정지용"),
      m("허태영"),
      m("백종찬"),
      m("오영민"),
      m("서재원"),
      m("장유빈"),
      m("김환희"),
      m("윤천민"),
      m("장시우"),
      m("남경우"),
    ],
    teachers: [
      m("김정희", true),
      m("오정희"),
      m("김지원"),
      m("심혜원"),
      m("정태훈"),
      m("김혜경"),
      m("전우진"),
      m("전예하"),
      m("정남기"),
      m("최하라"),
      m("남여라"),
      m("임세희"),
      m("조소남"),
    ],
  },
  {
    id: "innae",
    name: "인내조",
    color: "#DCEEFB",
    youth: [
      m("김민성A"),
      m("이종명"),
      m("김수연"),
      m("이영진"),
      m("황상현"),
      m("김세현"),
      m("나현호"),
      m("신우진"),
      m("정혜진"),
      m("전민호"),
      m("설찬엽"),
      m("송종화"),
      m("이시원"),
      m("박준우"),
      m("송윤서"),
    ],
    teachers: [
      m("김지영", true),
      m("김진욱"),
      m("김오순"),
      m("김정우"),
      m("고정화"),
      m("김종진"),
      m("한민경"),
      m("박미경"),
      m("이예린"),
      m("안희주"),
      m("이동욱"),
      m("기광국"),
    ],
  },
  {
    id: "younggwang",
    name: "영광조",
    color: "#DCF5E3",
    youth: [
      m("이권재"),
      m("오중석"),
      m("김지나"),
      m("이세준"),
      m("홍석찬"),
      m("김현재"),
      m("윤재민"),
      m("박태웅"),
      m("김민주"),
      m("이규민"),
      m("김민성B"),
      m("임종찬"),
      m("이은호"),
      m("박세준"),
      m("이필호"),
      m("최서인"),
    ],
    teachers: [
      m("윤정진", true),
      m("박준식"),
      m("조상화"),
      m("이복순"),
      m("임대성"),
      m("송승혜"),
      m("이미영"),
      m("박규수"),
      m("박수연"),
      m("정희연"),
      m("박경환"),
      m("이명선"),
      m("심재은"),
      m("이수한"),
      m("명관선"),
    ],
  },
  {
    id: "soman",
    name: "소망조",
    color: "#EADCFB",
    youth: [
      m("정윤오"),
      m("박준성"),
      m("조상화"),
      m("윤영수"),
      m("임희신"),
      m("김나나"),
      m("박기훈"),
      m("이승수"),
      m("방태헌"),
      m("민은혜"),
      m("이서준"),
      m("전준서"),
      m("이준영"),
    ],
    teachers: [
      m("이성숙", true),
      m("김해정"),
      m("김봉길"),
      m("임성규"),
      m("김성숙"),
      m("김성희"),
      m("주현기"),
      m("유미현"),
      m("송진혁"),
      m("장미아"),
      m("이은희"),
      m("김혜주"),
    ],
  },
];

const todayIso = (): string => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

let _xid = 0;
const ex = (name: string) => ({ id: `x_${_xid++}_${name}`, name });

const today = todayIso();

const initialRecord: DayRecord = {
  ...emptyDayRecord(),
  notes: {
    teacherCounts: "일반교사 56명, 봉사교사 3명",
    newcomers: "",
  },
};

export const INITIAL_STATE: AttendanceState = {
  date: today,
  teams: INITIAL_TEAMS,
  ministers: [ex("윤선영")],
  volunteerTeachers: [ex("이순민"), ex("황규선"), ex("최영훈")],
  observers: [],
  records: { [today]: initialRecord },
};
