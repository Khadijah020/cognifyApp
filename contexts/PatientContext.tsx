// context/PatientContext.tsx
import React, { createContext, useContext, useState } from 'react';

export type Patient = {
  id: string;
  name: string;
  stage?: string;
  dob?: string;
  address?: string;
  emergency?: string;
  allergies?: string;
  meds?: string;
  conditions?: string;
  notes?: string;
  likes?: string;
  avatar?: string;
  password?: string;
  email?: string;
};


const defaultPatient: Patient = {
  id: '1',
  name: 'John Doee',
  stage: 'Stage 4 Dementia',
  dob: 'January 15, 1945',
  address: '123 Memory Lane, Suite 2B',
  emergency: 'Jane Doe (Daughter) - 555-1234',
  allergies: 'Penicillin, Peanuts',
  meds: 'Donepezil, Memantine',
  conditions: 'Hypertension, Arthritis',
  notes: 'John enjoys listening to classical music in the evenings...',
  likes: 'Likes: Gardening, Old Movies, Puzzles. Dislikes: Loud noises, Spicy food.',
  avatar: undefined,
  password: '123456',
  email: 'jane@gmail.com',
};


const PatientContext = createContext<{
  patient: Patient;
  updatePatient: (p: Partial<Patient>) => void;
}>({
  patient: defaultPatient,
  updatePatient: () => {},
});

export const PatientProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [patient, setPatient] = useState(defaultPatient);

  const updatePatient = (p: Partial<Patient>) =>
    setPatient((prev) => ({ ...prev, ...p }));

  return (
    <PatientContext.Provider value={{ patient, updatePatient }}>
      {children}
    </PatientContext.Provider>
  );
};

export const usePatient = () => useContext(PatientContext);
