// src/modals/HospitalsModal.tsx
import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "../redux/store";

import { loadHospitals, updateDailyRoomCost } from "../redux/slices/hospitalSlice";
import { addHospital, deleteHospital } from "../redux/slices/adminSlice";
import { toast } from "react-toastify";

const HospitalsModal = ({ onClose }: { onClose: () => void }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { hospitals } = useSelector((s: RootState) => s.hospitals);
  const { organizations } = useSelector((s: RootState) => s.organizations);

  const [newHospital, setNewHospital] = useState("");
  const [rates, setRates] = useState<Record<number, number>>({});

  useEffect(() => {
    dispatch(loadHospitals());
  }, [dispatch]);

  useEffect(() => {
    const map: Record<number, number> = {};
    hospitals.forEach((h) => (map[h.id] = h.daily_room_cost));
    setRates(map);
  }, [hospitals]);

  // Convert org ID → org name
  const getOrgName = (orgId: number | null) => {
    if (!orgId) return "None";
    const org = organizations.find((o) => o.id === orgId);
    return org ? org.name : "None";
  };

  const handleAddHospital = () => {
    if (!newHospital.trim()) return;

    dispatch(addHospital({ name: newHospital }))
      .unwrap()
      .then(() => {
        toast.success("Hospital added");
        dispatch(loadHospitals());
        setNewHospital("");
      })
      .catch((err) => toast.error(err));
  };

  const handleSaveRate = (id: number) => {
    const newRate = rates[id];

    dispatch(updateDailyRoomCost({ hospitalId: id, daily_room_cost: newRate }))
      .unwrap()
      .then(() => toast.success("Rate updated"))
      .catch((err) => toast.error(err));
  };

  const handleDelete = (id: number) => {
    dispatch(deleteHospital(id))
      .unwrap()
      .then(() => {
        toast.success("Hospital deleted");
        dispatch(loadHospitals());
      })
      .catch((err) => toast.error(err));
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-xl overflow-hidden">

        {/* HEADER */}
        <div className="bg-[var(--prussian-blue)] text-white px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">Manage Hospitals</h2>
          <button className="text-white text-xl hover:opacity-80" onClick={onClose}>✕</button>
        </div>

        {/* CONTENT */}
        <div className="p-6 max-h-[80vh] overflow-y-auto">

          {/* ADD HOSPITAL */}
          <div className="card w-full text-white mb-6">
            <h3 className="text-lg font-semibold mb-3">Add New Hospital</h3>

            <div className="flex gap-3">
              <input
                className="bg-white text-black placeholder-gray-400 border rounded py-2 px-3 w-full"
                placeholder="Hospital Name"
                value={newHospital}
                onChange={(e) => setNewHospital(e.target.value)}
              />

              <button
                onClick={handleAddHospital}
                disabled={!newHospital.trim()}
                className={`
                  btn 
                  ${
                    newHospital
                      ? "bg-[var(--prussian-blue)] hover:opacity-90"
                      : "bg-gray-300 cursor-not-allowed"
                  }
                `}
              >
                Add
              </button>
            </div>
          </div>

          {/* HOSPITAL LIST */}
          <h3 className="text-lg font-semibold mb-3">Hospitals</h3>

          <div className="rounded-xl border border-gray-200 overflow-hidden divide-y">
            {hospitals.map((h) => (
              <div key={h.id} className="p-4 flex justify-between items-center bg-white">

                {/* NAME + ORG */}
                <div>
                  <div className="font-medium text-black">{h.name}</div>
                  <div className="text-sm text-gray-500">
                    Organization: {getOrgName(h.organization_id)}
                  </div>
                </div>

                {/* RATE EDIT */}
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    step="0.01"
                    className="bg-white text-black border rounded px-2 py-1 w-24"
                    value={rates[h.id]}
                    onChange={(e) =>
                      setRates((prev) => ({
                        ...prev,
                        [h.id]: Number(e.target.value),
                      }))
                    }
                  />

                  <button
                    onClick={() => handleSaveRate(h.id)}
                    className="bg-[var(--prussian-blue)] text-white px-3 py-1 rounded hover:opacity-90"
                  >
                    Save
                  </button>
                </div>

                {/* DELETE */}
                <button
                  className="text-red-600 text-sm hover:underline"
                  onClick={() => handleDelete(h.id)}
                >
                  Delete
                </button>

              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
};

export default HospitalsModal;
