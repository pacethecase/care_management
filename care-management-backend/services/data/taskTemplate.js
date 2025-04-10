const tasks = [
    { name: "Behavioral Contract Created", description: "Create behavioral contract within 48 hours.", is_repeating: false, recurrence_interval: null, max_repeats: null, condition_required: null, category: "Contract", dependency_name: null },
    { name: "Behavioral Contract Reassessment", description: "Review contract weekly and PRN.", is_repeating: true, recurrence_interval: 7, max_repeats: null, condition_required: "If patient is on behavioral plan", category: "Contract", dependency_name: "Behavioral Contract Created" },
  
    { name: "Medication Assessment", description: "Initial medication evaluation.", is_repeating: false, recurrence_interval: null, max_repeats: null, condition_required: null, category: "Medication", dependency_name: null },
    { name: "Medication Reassessment", description: "Ongoing medication review.", is_repeating: true, recurrence_interval: 3, max_repeats: null, condition_required: null, category: "Medication", dependency_name: "Medication Assessment" },
  
    { name: "Psychiatry Consult", description: "Psychiatry consult if no geriatric service or patient < 65.", is_repeating: false, recurrence_interval: null, max_repeats: null, condition_required: "If patient < 65 OR no geriatric psychiatry", category: "Psychiatry", dependency_name: null },
    { name: "Psychiatry Reassessment", description: "Ongoing psych follow-up.", is_repeating: true, recurrence_interval: 7, max_repeats: null, condition_required: "If Psychiatry Consult completed", category: "Psychiatry", dependency_name: "Psychiatry Consult" },
  
    { name: "Geriatric Psychiatry Consult", description: "48h consult for > 65 with geriatric psychiatry service.", is_repeating: false, recurrence_interval: null, max_repeats: null, condition_required: "If patient > 65 AND geriatric psychiatry available", category: "Geriatric Psychiatry", dependency_name: null },
    { name: "Geriatric Psychiatry Reassessment", description: "Weekly reassessment by geriatric psych.", is_repeating: true, recurrence_interval: 7, max_repeats: null, condition_required: "If Geriatric Psych Consult completed", category: "Geriatric Psychiatry", dependency_name: "Geriatric Psychiatry Consult" },
  
    { name: "Daily Nursing Documentation", description: "Nursing notes for interventions/outcomes.", is_repeating: true, recurrence_interval: 1, max_repeats: null, condition_required: null, category: "Documentation", dependency_name: null },
  
    { name: "Assessment of Appropriateness", description: "Review restraint usage.", is_repeating: false, recurrence_interval: null, max_repeats: null, condition_required: "If patient is restrained", category: "Restraint", dependency_name: null },
    { name: "Assessment of Appropriateness Reassesment", description: "Review restraint usage.", is_repeating: true, recurrence_interval: 3, max_repeats: null, condition_required: "If patient is restrained", category: "Restraint", dependency_name: "Assessment of Appropriateness" },
  
    { name: "Behavioral Intervention Team", description: "Activate BIT if needed.", is_repeating: false, recurrence_interval: null, max_repeats: null, condition_required: "If applicable", category: "Behavioral Intervention", dependency_name: null },
    { name: "BIT Reassessment", description: "Ongoing reassessment every 3 days & PRN.", is_repeating: true, recurrence_interval: 3, max_repeats: null, condition_required: "If Behavioral Team involved", category: "Behavioral Intervention", dependency_name: "Behavioral Intervention Team" },
];

module.exports = tasks;