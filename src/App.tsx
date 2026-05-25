import { useMemo, useState } from "react";
import Header from "./components/Header";
import TeamTabs from "./components/TeamTabs";
import TeamAttendance from "./components/TeamAttendance";
import ExtraGroups from "./components/ExtraGroups";
import EditMembersModal from "./components/EditMembersModal";
import SnapshotModal from "./components/SnapshotModal";
import RecordsModal from "./components/RecordsModal";
import InstallPrompt from "./components/InstallPrompt";
import { AttendanceProvider, useAttendance } from "./store/AttendanceStore";
import type { TeamId } from "./types";

function AttendanceScreen() {
  const { state, currentDay } = useAttendance();
  const [selectedTeam, setSelectedTeam] = useState<TeamId>("innae");
  const [editOpen, setEditOpen] = useState(false);
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const totals = useMemo(() => {
    let totalYouth = 0;
    let presentYouth = 0;
    let totalTeachers = 0;
    let presentTeachers = 0;
    const presentByTeam: Record<TeamId, number> = {
      sarang: 0,
      mideum: 0,
      innae: 0,
      younggwang: 0,
      soman: 0,
    };
    for (const team of state.teams) {
      totalYouth += team.youth.length;
      totalTeachers += team.teachers.length;
      const yCount = team.youth.filter(
        (m) => currentDay.presentIds[m.id],
      ).length;
      const tCount = team.teachers.filter(
        (m) => currentDay.presentIds[m.id],
      ).length;
      presentYouth += yCount;
      presentTeachers += tCount;
      presentByTeam[team.id] = yCount + tCount;
    }
    return { totalYouth, presentYouth, totalTeachers, presentTeachers, presentByTeam };
  }, [state, currentDay]);

  const team = state.teams.find((t) => t.id === selectedTeam)!;

  return (
    <div className="mx-auto flex min-h-full max-w-screen-md flex-col">
      <Header
        totalYouth={totals.totalYouth}
        presentYouth={totals.presentYouth}
        totalTeachers={totals.totalTeachers}
        presentTeachers={totals.presentTeachers}
        onOpenSnapshot={() => setSnapshotOpen(true)}
        onOpenEdit={() => setEditOpen(true)}
        onOpenRecords={() => setExportOpen(true)}
      />

      <InstallPrompt />

      <div className="px-4">
        <TeamTabs
          teams={state.teams}
          selected={selectedTeam}
          onSelect={setSelectedTeam}
          presentByTeam={totals.presentByTeam}
        />
      </div>

      <main className="flex-1 space-y-3 px-4 pt-2 pb-24">
        <TeamAttendance team={team} />
        <ExtraGroups />
        <Footer />
      </main>

      <EditMembersModal
        open={editOpen}
        initialTeamId={selectedTeam}
        onClose={() => setEditOpen(false)}
      />
      <SnapshotModal open={snapshotOpen} onClose={() => setSnapshotOpen(false)} />
      <RecordsModal open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  );
}

function Footer() {
  return (
    <div className="pt-2 text-center text-[11px] leading-relaxed text-slate-400">
      탭하면 O 표시 · 데이터는 이 기기에만 저장됩니다
    </div>
  );
}

export default function App() {
  return (
    <AttendanceProvider>
      <AttendanceScreen />
    </AttendanceProvider>
  );
}
