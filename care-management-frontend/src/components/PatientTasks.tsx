import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  loadPatientTasks,
  startTask,
  completeTask,
  markTaskAsMissed,
} from '../redux/slices/taskSlice';
import { fetchPatientById } from '../redux/slices/patientSlice';
import { fetchPatientNotes, addPatientNote } from '../redux/slices/noteSlice';
import { RootState } from '../redux/store';
import {
  ArrowLeft, Calendar, Activity, Clock, CheckCircle, Heart, User
} from 'lucide-react';
import { toast } from 'react-toastify';

const PatientTasks = () => {
  const { patientId } = useParams();
  const dispatch = useDispatch();

  const [selectedTab, setSelectedTab] = useState<'Pending' | 'In Progress' | 'Completed' | 'All Tasks' | 'Notes'>('In Progress');
  const [newNote, setNewNote] = useState('');

  const { patientTasks, loading: taskLoading } = useSelector((state: RootState) => state.tasks);
  const { selectedPatient: patient, loading: patientLoading } = useSelector((state: RootState) => state.patients);
  const { notes } = useSelector((state: RootState) => state.notes);
  const { user } = useSelector((state: RootState) => state.user);

  useEffect(() => {
    if (patientId) {
      dispatch(fetchPatientById(Number(patientId)));
      dispatch(loadPatientTasks(Number(patientId)));
      if (selectedTab === 'Notes') {
        dispatch(fetchPatientNotes(Number(patientId)));
      }
    }
  }, [dispatch, patientId, selectedTab]);

  const handleStart = (taskId: number) => {
    dispatch(startTask(taskId))
      .unwrap()
      .then(() => {
        toast.success("✅ Task started");
        dispatch(loadPatientTasks(Number(patientId))); // ✅ Refresh list
      })
      .catch(() => toast.error("❌ Failed to start task"));
  };
  
  const handleComplete = (taskId: number) => {
    dispatch(completeTask(taskId))
      .unwrap()
      .then(() => {
        toast.success("✅ Task completed");
        dispatch(loadPatientTasks(Number(patientId))); // ✅ Refresh list
      })
      .catch(() => toast.error("❌ Failed to complete task"));
  };
  
  const handleMissed = (taskId: number) => {
    const reason = prompt("Enter missed reason:");
    if (reason) {
      dispatch(markTaskAsMissed({ taskId, reason }))
        .unwrap()
        .then(() => {
          toast.success("✅ Task marked as missed");
          dispatch(loadPatientTasks(Number(patientId))); // ✅ Refresh list
        })
        .catch(() => toast.error("❌ Failed to mark as missed"));
    }
  };
  
  const addNote = () => {
    if (!newNote.trim()) return toast.error("Note cannot be empty!");
    dispatch(addPatientNote({ patientId: Number(patientId), staff_id: user!.id!, note_text: newNote }))
      .then(() => {
        setNewNote('');
        toast.success("✅ Note added");
      });
  };

  const getStatusBadge = (status: string) => {
    const base = "inline-block px-3 py-1 text-xs font-medium rounded-full";
    const colors: any = {
      'Pending': 'bg-yellow-50 text-yellow-700',
      'In Progress': 'bg-blue-50 text-blue-700',
      'Completed': 'bg-green-50 text-green-700'
    };
    return <span className={`${base} ${colors[status] || 'bg-gray-100 text-gray-600'}`}>{status}</span>;
  };

  const filteredTasks = selectedTab === 'All Tasks' 
    ? patientTasks 
    : patientTasks.filter(task => task.status === selectedTab);

  const renderNotes = () => (
    <div className="bg-white p-4 rounded-lg shadow-md">
      <textarea
        className="w-full p-2 border rounded mb-2"
        placeholder="Write a new note..."
        value={newNote}
        onChange={(e) => setNewNote(e.target.value)}
      />
      <button className="btn btn-primary" onClick={addNote}>Add Note</button>
      {notes.map(note => (
        <div key={note.id} className="border-b py-2">
          <p>{note.note_text}</p>
          <span className="text-xs text-gray-400">{new Date(note.created_at).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );

  const renderTasks = () => (
    filteredTasks.map(task => (
      <div key={task.task_id} className="bg-white p-4 rounded shadow border">
        <div className="flex justify-between">
          <h3 className="font-bold">{task.task_name}</h3>
          {getStatusBadge(task.status)}
        </div>
        <p className="text-sm text-gray-500">{task.description}</p>
        <div className="flex gap-2 mt-2 text-sm text-gray-600">
          <Calendar className="w-4 h-4" /> Due: {new Date(task.due_date).toLocaleDateString()}
          {task.condition_required && <><Activity className="w-4 h-4 ml-2" /> {task.condition_required}</>}
        </div>
        {task.status !== 'Completed' && (
          <div className="flex gap-2 mt-3">
            {task.status !== 'In Progress' && (
              <button onClick={() => handleStart(task.task_id)} className="btn">Start</button>
            )}
            <button onClick={() => handleComplete(task.task_id)} className="btn btn-primary">Complete</button>
            <button onClick={() => handleMissed(task.task_id)} className="btn bg-red-600 text-white">Missed</button>
          </div>
        )}
      </div>
    ))
  );

  if (patientLoading || taskLoading || !patient) return <p>Loading patient data...</p>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link to="/patients" className="text-hospital-blue flex items-center mb-4">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Patients
      </Link>

      <div className="bg-white p-6 rounded shadow border mb-6">
        <h2 className="text-2xl font-bold">{patient.name}</h2>
        <p className="text-gray-600">
          Age {patient.age} • Bed {patient.bed_id} • Admitted on {new Date(patient.created_at).toLocaleDateString()}
        </p>
      </div>

      <div className="flex space-x-2 border-b mb-4">
        {['Pending', 'In Progress', 'Completed', 'All Tasks', 'Notes'].map(tab => (
          <button
            key={tab}
            onClick={() => setSelectedTab(tab as any)}
            className={`py-2 px-4 ${selectedTab === tab ? 'border-b-2 text-hospital-blue' : 'text-gray-500'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {selectedTab === 'Notes' ? renderNotes() : renderTasks()}
    </div>
  );
};

export default PatientTasks;
