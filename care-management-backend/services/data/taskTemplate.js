const { desc } = require("framer-motion/client");

const tasks = [
    { name: "Behavioral Contract Created", description: "Create behavioral contract within 48 hours.", is_repeating: false, recurrence_interval: null, max_repeats: null, condition_required: null, category: "Contract", dependency_name: null,algorithm:"Behavioral" },
    { name: "Behavioral Contract Reassessment", description: "Review contract weekly and PRN.", is_repeating: true, recurrence_interval: 7, max_repeats: null, condition_required: "If patient is on behavioral plan", category: "Contract", dependency_name: ["Behavioral Contract Created"] ,algorithm:"Behavioral" },
  
    { name: "Medication Assessment", description: "Initial medication evaluation.", is_repeating: false, recurrence_interval: null, max_repeats: null, condition_required: null, category: "Medication", dependency_name: null ,algorithm:"Behavioral" },
    { name: "Medication Reassessment", description: "Ongoing medication review.", is_repeating: true, recurrence_interval: 3, max_repeats: null, condition_required: null, category: "Medication", dependency_name: ["Medication Assessment"],algorithm:"Behavioral"  },
  
    { name: "Psychiatry Consult", description: "Psychiatry consult if no geriatric service or patient < 65.", is_repeating: false, recurrence_interval: null, max_repeats: null, condition_required: "If patient < 65 OR no geriatric psychiatry", category: "Psychiatry", dependency_name: null ,algorithm:"Behavioral" },
    { name: "Psychiatry Reassessment", description: "Ongoing psych follow-up.", is_repeating: true, recurrence_interval: 7, max_repeats: null, condition_required: "If Psychiatry Consult completed", category: "Psychiatry", dependency_name: ["Psychiatry Consult"],algorithm:"Behavioral"  },
  
    { name: "Geriatric Psychiatry Consult", description: "48h consult for > 65 with geriatric psychiatry service.", is_repeating: false, recurrence_interval: null, max_repeats: null, condition_required: "If patient > 65 AND geriatric psychiatry available", category: "Geriatric Psychiatry", dependency_name: null,algorithm:"Behavioral"  },
    { name: "Geriatric Psychiatry Reassessment", description: "Weekly reassessment by geriatric psych.", is_repeating: true, recurrence_interval: 7, max_repeats: null, condition_required: "If Geriatric Psych Consult completed", category: "Geriatric Psychiatry", dependency_name: ["Geriatric Psychiatry Consult"] ,algorithm:"Behavioral" },
  
    { name: "Daily Nursing Documentation", description: "Nursing notes for interventions/outcomes.", is_repeating: true, recurrence_interval: 1, max_repeats: null, condition_required: null, category: "Documentation", dependency_name: null ,algorithm:"Behavioral" },
  
    { name: "Assessment of Appropriateness", description: "Review restraint usage.", is_repeating: false, recurrence_interval: null, max_repeats: null, condition_required: "If patient is restrained", category: "Restraint", dependency_name: null ,algorithm:"Behavioral" },
    { name: "Assessment of Appropriateness Reassesment", description: "Review restraint usage.", is_repeating: true, recurrence_interval: 3, max_repeats: null, condition_required: "If patient is restrained", category: "Restraint", dependency_name: ["Assessment of Appropriateness"] ,algorithm:"Behavioral" },
  
    { name: "Behavioral Intervention Team", description: "Activate BIT if needed.", is_repeating: false, recurrence_interval: null, max_repeats: null, condition_required: "If applicable", category: "Behavioral Intervention", dependency_name: null ,algorithm:"Behavioral" },
    { name: "BIT Reassessment", description: "Ongoing reassessment every 3 days & PRN.", is_repeating: true, recurrence_interval: 3, max_repeats: null, condition_required: "If Behavioral Team involved", category: "Behavioral Intervention", dependency_name: ["Behavioral Intervention Team"] ,algorithm:"Behavioral" },


    {name:"Appropriate Office Contacted ASAP", description:"Contact Appropriate Office", is_repeating:false, recurrence_interval:null, max_repeats:null ,condition_required:"If Emergency Petition Required",category:"Initial Contract",dependency_name:null,due_in_days_after_dependency:2,algorithm:"Guardianship" },

    {name:"Emergency Court Petition Initiated",description:"Initiate the court Petition",is_repeating:false,recurrence_interval:null,max_repeats:null,condition_required:null,category:"Court",dependency_name:null,algorithm:"Guardianship"},
    {name:"Emergency Court Petition Filed",description:"File the Court Petition",is_repeating:false,recurrence_interval:null,max_repeats:null,condition_required:null,category:"Court",dependency_name:["Emergency Court Petition Initiated"],due_in_days_after_dependency: 2,algorithm:"Guardianship"},


    {name:"Confirm Guardianship Appointed", description:"Guardianship Appointed should be confirmed",is_repeating:false,recurrence_interval:null, max_repeats:null,condition_required:"only if emergency",category:"GuardianShip",dependency_name:["Emergency Court Petition Filed"],due_in_days_after_dependency: 3,algorithm:"Guardianship"},
    {name:"Court date confirmed", description:"Confirmed the court date",is_repeating:false,recurrence_interval:null, max_repeats:null,condition_required:"only if emergency",category:"Court",dependency_name:["Confirm Guardianship Appointed"],due_in_days_after_dependency: 1,algorithm:"Guardianship"},

    {name:"Permanent Court Petition Initiated",description:"Initiate Court Petition after court date is received",is_repeating:false,recurrence_interval:null, max_repeats:null,condition_required:"If emergency and Court Date received",category:"Court",dependency_name:["Court date confirmed"],due_in_days_after_dependency: 2,algorithm:"Guardianship"},
    {name:"Permanent Court Petition Filed", description:"File Court Petition after Court Date is Received",is_repeating:false,recurrence_interval:null,max_repeats:null,condition_required:"If emergency and Court Date received",category:"Court",dependency_name:["Permanent Court Petition Initiated"],due_in_days_after_dependency: 1,algorithm:"Guardianship"},

    {name:"Hospital Representatives to testify identified and notified",description:"Hospital Representatives identified",is_repeating:false,recurrence_interval:null,max_repeats:null,condition_required:"If emergency and Court Date received",category:"Court",dependency_name:["Permanent Court Petition Filed"],is_non_blocking:true,algorithm:"Guardianship"},

    {name:"Evaluation and/or supporting documentation completed / available",description:"Evaluating the documents",is_repeating:false,recurrence_interval:null, max_repeats:null,condition_required:null,category:"Documents",dependency_name:["Permanent Court Petition Initiated"],is_non_blocking:true,algorithm:"Guardianship"},
    {name:"Responsibility for Court Petition Fees", description:"Find out who is responsible for court petition fees and update the notes",is_repeating:false,recurrence_interval:null,max_repeats:null,condition_required:null,category:"Fees",dependency_name:["Permanent Court Petition Initiated"],  is_non_blocking:true,algorithm:"Guardianship"},

    {name:"Guardian ad litem appointed?", description:"Guardian ad litem appointed?",is_repeating:false,recurrence_interval:null, max_repeats:null,condition_required:null,category:"Documents",dependency_name:["Permanent Court Petition Filed"],is_non_blocking:true,algorithm:"Guardianship"},
    {name:"Is a fiduciary bond required?", description:"Check if fiduciary bond is required",is_repeating:false,recurrence_interval:null, max_repeats:null,condition_required:null,category:"Documents",dependency_name:["Permanent Court Petition Filed"],is_non_blocking:true,algorithm:"Guardianship"},

    {name:"Identify Guardian",description:"Identify the Guardian",is_repeating:false,recurrence_interval:null,max_repeats:null,condition_required:null,category:"GuardianShip",dependency_name:null,algorithm:"Guardianship"},

    {name:"Financial inventory of patient assets required", description:"Inventory of Patients's Assests needed",is_repeating:false,recurrence_interval:null,max_repeats:null,condition_required:null,category:"Financial",dependency_name:null,algorithm:"Guardianship"},
    {name:"Evaluate Status of Compile",description:"Every 48 hours Evaluate the status of financial Compile",is_repeating:true,recurrence_interval:2,max_repeats:null,condition_required:"If Financial",category:"Financial",dependency_name:["Financial inventory of patient assets required"],algorithm:"Guardianship"},

    {name:"Court Hearing Date Received if not follow up completed", description:"Get the Court Hearing Dates as soon as possible", is_repeating:true, recurrence_interval:7,max_repeats:null, condition_required:"If court hearing date not yet received", category:"Court", dependency_name: ["Permanent Court Petition Filed"],due_in_days_after_dependency: 1,algorithm:"Guardianship"},

    {name:"Withdraw Petition", description:"Withdraw the petition if necessary", is_repeating:false, recurrence_interval:null,max_repeats:null, condition_required:null, category:"Court", dependency_name:["Court Hearing Date Received if not follow up completed"],is_non_blocking:true,algorithm:"Guardianship"},
    {name:"Plan- Transportation or Virtual", description:"Plan accordingly how to attend the court", is_repeating:false, recurrence_interval:null,max_repeats:null, condition_required:null, category:"Court", dependency_name:["Court Hearing Date Received if not follow up completed"],is_non_blocking:true,algorithm:"Guardianship"},
    
    {name:"Court Appointed Attorney - visit planned?", description:"Plan Visit for Court Appointed Attorney", is_repeating:false, recurrence_interval:null,max_repeats:null, condition_required:null, category:"Court", dependency_name:["Plan- Transportation or Virtual"],is_non_blocking:true,algorithm:"Guardianship"},
    {name:"Following court hearing,determination received and if not, follow-up completed",description:"Following up in Court", is_repeating:true, recurrence_interval:7,max_repeats:null, condition_required:"After court hearing until determination received", category:"Court", dependency_name:["Court Hearing Date Received if not follow up completed"],due_in_days_after_dependency: 1,algorithm:"Guardianship"},

    {name:"Appeal Court Decision", description:"Appeal Court Description if necessary", is_repeating:false, recurrence_interval:null,max_repeats:null, condition_required:null, category:"Court", dependency_name:["Following court hearing,determination received and if not, follow-up completed"],is_non_blocking:true,algorithm:"Guardianship"},

    {name:"Initiate appropriate application process", description:"Initiate Appropriate Application for LTC as per criteria",  is_repeating:false, recurrence_interval:null,max_repeats:null, condition_required:null, category:"Documentation", dependency_name:null,algorithm:"LTC"},
    {name:"Complete the Medical Eligibility Assessment application / required forms and compile supporting medical documentation",description:"Complete necessary steps to determine financial eligibility",is_repeating:false, recurrence_interval:null,max_repeats:null, condition_required:null, category:"Documentation", dependency_name:null,due_in_days_after_dependency:3,algorithm:"LTC"},

    {name:"Complete Financial Screening and Determine Eligibility" ,description:"Complete Necessary Screening and determine eligibilty", is_repeating:false, recurrence_interval:null,max_repeats:null, condition_required:"If financial LTC", category:"Documentation", dependency_name:null,due_in_days_after_dependency:2,algorithm:"LTC"},
    {name:"Complete Financial Application", description:"Complete Application", is_repeating:false, recurrence_interval:null,max_repeats:null, condition_required:"If financial LTC and eligibilty determined", category:"Documentation", dependency_name:["Complete Financial Screening and Determine Eligibility"],due_in_days_after_dependency:2,algorithm:"LTC"},
    {name:"Submit Financial Application to the State",description:"Submit Application to State",is_repeating:false, recurrence_interval:null,max_repeats:null, condition_required:"If financial LTC and eligibilty determined", category:"Documentation", dependency_name:["Complete Financial Application"],due_in_days_after_dependency:1,algorithm:"LTC"},
    {name:"Submit Medical Application to the State",description:"Submit Application to State",is_repeating:false, recurrence_interval:null,max_repeats:null, condition_required:"If medical LTC and eligibilty determined", category:"Documentation", dependency_name:["Complete the Medical Eligibility Assessment application / required forms and compile supporting medical documentation"],due_in_days_after_dependency:1,algorithm:"LTC"},

    {name:"Follow up with state on medical application status",description:"Follow up", is_repeating:true, recurrence_interval:5,max_repeats:null,condition_required:"If Medical LTC",category:"State",dependency_name:["Submit Medical Application to the State"],due_in_days_after_dependency:1,algorithm:"LTC"},
    {name:"Begin compiling needed financial/legal information", description:"Start Compiling all the information",is_repeating:false, recurrence_interval:null,max_repeats:null, condition_required:"If financial LTC and eligibilty determined", category:"Documentation", dependency_name:["Submit Financial Application to the State"],due_in_days_after_dependency:1,algorithm:"LTC"},
    {name:"Follow-up on status of compiling of financial/legal information; submit as received",description:"Follow-up on status of compiling of financial/legal information; submit as received",is_repeating:true,recurrence_interval:2,max_repeats:null,condition_required:"If financial LTC and eligibilty determined",category:"Documentation",dependency_name:["Begin compiling needed financial/legal information"],due_in_days_after_dependency:2,algorithm:"LTC"},
    {name:"if lack of communication and/or forward movement with compiling of financial/legal information, engage Risk and/or Legal",description:"Involve legal if lack of communication",is_repeating:false,recurrence_interval:null,max_repeats:null,condition_required:"If financial LTC and eligibilty determined",category:"Legal",dependency_name:["Submit Financial Application to the State","Submit Medical Application to the State"],due_in_days_after_dependency:1,algorithm:"LTC"},
   
    {name:"Is Release of Information (ROI) / Authorized Representative needed for hospital follow-up purposes?",description:"Is ROI needed?",is_repeating:false, recurrence_interval:null,max_repeats:null, condition_required:"If financial LTC and eligibilty determined", category:"Documentation", dependency_name:["Submit Application to the State"],is_non_blocking:true,algorithm:"LTC"}, 
    {name:"Confirm date/time of States initial steps including Intake Interview: if not scheduled, follow-up with State",description:"Confirm date/time of States initial steps including Intake Interview: if not scheduled, follow-up with State",is_repeating:true, recurrence_interval:2,max_repeats:null, condition_required:"If submitted documents to state", category:"Court", dependency_name: ["Submit Financial Application to the State","Submit Medical Application to the State"],due_in_days_after_dependency: 1,algorithm:"LTC"},

];


module.exports = tasks;