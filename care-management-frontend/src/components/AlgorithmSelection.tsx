import React from "react";

interface AlgorithmSelectionProps<T extends { birth_date: string }> {
  formData: T;
  setFormData: React.Dispatch<React.SetStateAction<T>>;
}

const getAge = (birthDate: string): number => {
  if (!birthDate) return 0;
  const [year, month, day] = birthDate.split("-").map(Number);
  const today = new Date();
  let age = today.getFullYear() - year;
  const hasBirthdayPassed =
    today.getMonth() + 1 > month ||
    (today.getMonth() + 1 === month && today.getDate() >= day);
  if (!hasBirthdayPassed) age--;
  return age >= 0 ? age : 0;
};

const AlgorithmSelection = <T extends { birth_date: string }>({
  formData,
  setFormData,
}: AlgorithmSelectionProps<T>) => {

  const age = getAge(formData.birth_date);
  const geriatricEligible = age > 65;

  const algorithms = [
    {
      key: "is_behavioral",
      label: "Behavioral",
      subOptions: [
        { key: "is_restrained",                label: "Is Patient Restrained?" },
        { key: "is_behavioral_team",            label: "Behavioral Intervention Team Needed?" },
        { key: "is_geriatric_psych_available",  label: "Geriatric Psychiatry Available?" },
      ],
    },
    {
      key: "is_ltc",
      label: "LTC",
      subOptions: [
        { key: "is_ltc_medical",   label: "Medical Eligibility" },
        { key: "is_ltc_financial", label: "Financial Eligibility" },
      ],
    },
    {
      key: "is_guardianship",
      label: "Guardianship",
      subOptions: [
        { key: "is_guardianship_financial", label: "Financial Requirement" },
        { key: "is_guardianship_person",    label: "Person Requirement" },
        { key: "is_guardianship_emergency", label: "Emergency Required" },
      ],
    },
  ];

  const handleSelection = (
    e: React.MouseEvent<HTMLButtonElement>,
    key: keyof T
  ) => {
    e.preventDefault();
    setFormData((prev) => {
      const newValue = !prev[key];
      const updated: Record<string, any> = { ...prev, [key]: newValue };

      if (!newValue) {
        const algo = algorithms.find((a) => a.key === key);
        algo?.subOptions.forEach(({ key: subKey }) => {
          updated[subKey] = false;
        });
      }

      return updated as T;
    });
  };

  const handleSubOptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;

    setFormData((prev) => {
      const updated: Record<string, any> = { ...prev, [name]: checked };
      if (name === "is_geriatric_psych_available" && !geriatricEligible) {
        updated[name] = false;
      }

      return updated as T;
    });
  };

  return (
    <div className="md:col-span-2">
      <p className="font-medium mb-3 text-lg">Patient Tags:</p>

      <div className="flex flex-wrap text-white gap-3 mb-6">
        {algorithms.map(({ key, label }) => (
          <button
            key={key}
            className={`tab px-6 py-2 rounded-lg font-semibold transition-all duration-300 focus:outline-none border ${
              formData[key as keyof T]
                ? "shadow"
                : "border-transparent hover:bg-[var(--hover-tab)]"
            }`}
            onClick={(e) => handleSelection(e, key as keyof T)}
          >
            {label}
          </button>
        ))}
      </div>

      {algorithms.map(
        (alg) =>
          formData[alg.key as keyof T] && (
            <div
              key={alg.key}
              className="p-5 mb-5 bg-white text-black rounded-md border border-[var(--border-muted)] shadow-sm"
            >
              <p className="font-semibold mb-3">{alg.label} Details:</p>

              <div className="flex flex-row gap-6 flex-wrap">
                {alg.subOptions.map(({ key, label }) => {
                  // FIX: use computed age from birth_date
                  const isDisabled = key === "is_geriatric_psych_available" && !geriatricEligible;
                  return (
                    <label
                      key={key}
                      className="flex items-center gap-3 text-[var(--text-dark)]"
                    >
                      <input
                        type="checkbox"
                        name={key}
                        checked={!!formData[key as keyof T]}
                        onChange={handleSubOptionChange}
                        disabled={isDisabled}
                        className="w-4 h-4 text-[var(--funky-orange)] border-gray-300 rounded"
                      />
                      <span className={isDisabled ? "text-gray-400" : ""}>
                        {label}
                        {key === "is_geriatric_psych_available" && !geriatricEligible && (
                          <span className="ml-1 text-xs">(requires age &gt; 65)</span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )
      )}
    </div>
  );
};

export default AlgorithmSelection;