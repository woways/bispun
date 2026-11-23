export const MOCK_LEADS = [
  { id: 1, name: 'Aditya Reddy', source: 'Google Form', campaign: 'MBBS-Ukraine-Q4', medium: 'Meta Ads', stage: 'New', assigned: 'Priya S.', created: '2h ago', phone: '+91 98765 12340', course: 'MBBS Abroad' },
  { id: 2, name: 'Sneha Patel', source: 'Website Form', campaign: 'MBA-Study-Abroad', medium: 'Google Ads', stage: 'Contacted', assigned: 'Rahul M.', created: '5h ago', phone: '+91 98765 12341', course: 'MBA UK' },
  { id: 3, name: 'Vikram Iyer', source: 'IM Leads', campaign: 'Instagram-BDS', medium: 'Instagram DM', stage: 'Qualified', assigned: 'Priya S.', created: '1d ago', phone: '+91 98765 12342', course: 'BDS' },
  { id: 4, name: 'Kavya Rao', source: 'DM Leads', campaign: 'Whatsapp-Bulk', medium: 'WhatsApp', stage: 'Counselling', assigned: 'Anjali T.', created: '1d ago', phone: '+91 98765 12343', course: 'Engineering' },
  { id: 5, name: 'Rohan Sharma', source: 'Google Form', campaign: 'MBBS-Georgia', medium: 'Meta Ads', stage: 'Admitted', assigned: 'Rahul M.', created: '2d ago', phone: '+91 98765 12344', course: 'MBBS Georgia' },
  { id: 6, name: 'Meera Singh', source: 'Website Form', campaign: 'Nursing-Program', medium: 'Organic', stage: 'Lost', assigned: 'Priya S.', created: '3d ago', phone: '+91 98765 12345', course: 'Nursing' },
  { id: 7, name: 'Arjun Nair', source: 'IM Leads', campaign: 'Insta-Story-Ads', medium: 'Instagram', stage: 'New', assigned: 'Anjali T.', created: '3d ago', phone: '+91 98765 12346', course: 'MBBS Russia' },
  { id: 8, name: 'Divya Menon', source: 'Google Form', campaign: 'MBBS-Kyrgyzstan', medium: 'Meta Ads', stage: 'Qualified', assigned: 'Rahul M.', created: '4d ago', phone: '+91 98765 12347', course: 'MBBS Kyrgyzstan' },
];

export const UTM_LINKS = [
  { id: 1, campaign: 'MBBS-Ukraine-Q4', source: 'meta', medium: 'cpc', url: 'sm.crm/l/mbbs-uk-q4', clicks: 4820, regs: 612, leads: 289, conv: 42, adm: 18, rev: 540000 },
  { id: 2, campaign: 'MBA-Study-Abroad', source: 'google', medium: 'cpc', url: 'sm.crm/l/mba-abroad', clicks: 2140, regs: 342, leads: 156, conv: 28, adm: 9, rev: 360000 },
  { id: 3, campaign: 'Instagram-BDS', source: 'instagram', medium: 'social', url: 'sm.crm/l/bds-insta', clicks: 3210, regs: 501, leads: 220, conv: 35, adm: 12, rev: 240000 },
  { id: 4, campaign: 'Whatsapp-Bulk-Nov', source: 'whatsapp', medium: 'im', url: 'sm.crm/l/wa-nov', clicks: 892, regs: 512, leads: 401, conv: 62, adm: 24, rev: 720000 },
  { id: 5, campaign: 'MBBS-Georgia', source: 'meta', medium: 'cpc', url: 'sm.crm/l/mbbs-ge', clicks: 5610, regs: 720, leads: 340, conv: 58, adm: 22, rev: 660000 },
];

export const MOCK_ADMISSIONS = [
  { id: 1, name: 'Rohan Sharma', college: 'Tbilisi State Medical', course: 'MBBS Georgia', paid: 300000, total: 380000, status: 'Ongoing', counsellor: 'Rahul M.' },
  { id: 2, name: 'Priya Verma', college: 'Kharkiv National Medical', course: 'MBBS Ukraine', paid: 450000, total: 450000, status: 'Completed', counsellor: 'Priya S.' },
  { id: 3, name: 'Karan Malhotra', college: 'Manchester Business School', course: 'MBA UK', paid: 180000, total: 800000, status: 'Ongoing', counsellor: 'Rahul M.' },
  { id: 4, name: 'Ananya Kapoor', college: 'Osh State Medical', course: 'MBBS Kyrgyzstan', paid: 320000, total: 320000, status: 'Completed', counsellor: 'Anjali T.' },
  { id: 5, name: 'Suresh Babu', college: 'Manipal University', course: 'BDS', paid: 90000, total: 240000, status: 'Ongoing', counsellor: 'Priya S.' },
  { id: 6, name: 'Nikita Jain', college: 'Tver State Medical', course: 'MBBS Russia', paid: 0, total: 400000, status: 'Pending', counsellor: 'Rahul M.' },
];

export const MOCK_COUNSELLING = [
  { id: 1, date: '12 Aug, 2:00 PM', student: 'Aditya Reddy', counsellor: 'Priya S.', mode: 'Google Meet', link: 'meet.google.com/abc-defg-hij', accompaniedBy: 'Father (Mr. Reddy)', course: 'MBBS Georgia', remarks: 'Strong interest, budget confirmed 4.5L. Send Tbilisi & Batumi options.', status: 'Completed', followUp: '14 Aug' },
  { id: 2, date: '12 Aug, 4:30 PM', student: 'Sneha Patel', counsellor: 'Rahul M.', mode: 'In-person', link: '—', accompaniedBy: 'Mother + Brother', course: 'MBA UK', remarks: 'Concerned about IELTS score (6.5). Suggested retake or lower-tier unis.', status: 'Completed', followUp: '18 Aug' },
  { id: 3, date: '13 Aug, 11:00 AM', student: 'Vikram Iyer', counsellor: 'Priya S.', mode: 'Zoom', link: 'zoom.us/j/9821347611', accompaniedBy: 'Alone', course: 'BDS', remarks: '—', status: 'Scheduled', followUp: '—' },
  { id: 4, date: '13 Aug, 3:00 PM', student: 'Kavya Rao', counsellor: 'Anjali T.', mode: 'Google Meet', link: 'meet.google.com/xyz-pqrs-tuv', accompaniedBy: 'Father', course: 'Engineering', remarks: '—', status: 'Scheduled', followUp: '—' },
  { id: 5, date: '11 Aug, 5:00 PM', student: 'Arjun Nair', counsellor: 'Rahul M.', mode: 'In-person', link: '—', accompaniedBy: 'Uncle (guardian)', course: 'MBBS Russia', remarks: 'Not ready to commit. Follow up in 2 weeks after NEET result.', status: 'Completed', followUp: '25 Aug' },
];

export const MOCK_WALKINS = [
  { id: 1, arrived: '12 Aug, 10:30 AM', name: 'Ramesh Kumar', phone: '+91 98111 22345', purpose: 'MBBS Ukraine enquiry', accompaniedBy: 'Son (student)', counsellor: 'Priya S.', outcome: 'Documents shared, follow-up scheduled', status: 'Converted-to-lead' },
  { id: 2, arrived: '12 Aug, 12:15 PM', name: 'Kavya Rao', phone: '+91 98765 12343', purpose: 'Course brochure pickup', accompaniedBy: 'Father', counsellor: 'Anjali T.', outcome: 'Counselling booked for 13 Aug', status: 'Converted-to-lead' },
  { id: 3, arrived: '12 Aug, 2:45 PM', name: 'Anonymous walk-in', phone: '—', purpose: 'General enquiry', accompaniedBy: 'Alone', counsellor: 'Front desk', outcome: 'Not interested after price discussion', status: 'Lost' },
  { id: 4, arrived: '11 Aug, 4:00 PM', name: 'Meera Ghosh', phone: '+91 98111 55677', purpose: 'MBA UK enquiry', accompaniedBy: 'Husband', counsellor: 'Rahul M.', outcome: 'Full quotation sent', status: 'In-progress' },
  { id: 5, arrived: '11 Aug, 5:30 PM', name: 'Dinesh P.', phone: '+91 98111 99001', purpose: 'Nursing programs abroad', accompaniedBy: 'Daughter (student)', counsellor: 'Priya S.', outcome: 'Not a fit, referred elsewhere', status: 'Lost' },
];

export const MOCK_QUOTES = [
  { id: 'Q-1042', student: 'Karan Malhotra', course: 'MBA UK', base: 850000, discount: 50000, final: 800000, status: 'Sent', validity: '30 Aug' },
  { id: 'Q-1041', student: 'Sneha Patel', course: 'MBA UK', base: 850000, discount: 100000, final: 750000, status: 'Negotiating', validity: '25 Aug' },
  { id: 'Q-1040', student: 'Rohan Sharma', course: 'MBBS Georgia', base: 400000, discount: 20000, final: 380000, status: 'Accepted', validity: '—' },
  { id: 'Q-1039', student: 'Nikita Jain', course: 'MBBS Russia', base: 420000, discount: 20000, final: 400000, status: 'Sent', validity: '20 Aug' },
];

export const MOCK_LEAD_STORE = [
  { id: 1, name: 'NEET 2025 Aspirants — Telangana', type: 'External Data', count: 12400, uploaded: '10 Aug 2026', assigned: 'Team A (Priya)', converted: 42 },
  { id: 2, name: 'Walk-in Enquiries — Aug 2026', type: 'Offline LeadGen', count: 148, uploaded: '05 Aug 2026', assigned: 'Team B (Rahul)', converted: 18 },
  { id: 3, name: 'Purchased List — Justdial MBBS', type: 'Purchased Leads', count: 3400, uploaded: '01 Aug 2026', assigned: 'Team A (Priya)', converted: 12 },
  { id: 4, name: 'Uploaded — Old Website Leads', type: 'Uploaded Lists', count: 8900, uploaded: '20 Jul 2026', assigned: 'Team C (Anjali)', converted: 34 },
];

export const MOCK_TICKETS = [
  { id: 'T-2041', tenant: 'Horizon Academy', title: 'Add "Counsellor Category" field', priority: 'Medium', status: 'Under Review', type: 'Customization Request', created: '2d ago' },
  { id: 'T-2040', tenant: 'ABC Consultancy', title: 'WhatsApp Business API integration', priority: 'High', status: 'Approved', type: 'Integration Request', created: '3d ago' },
  { id: 'T-2039', tenant: 'XYZ Admissions', title: 'Bulk lead import failing on rows > 5000', priority: 'High', status: 'Development', type: 'Technical Issue', created: '4d ago' },
  { id: 'T-2038', tenant: 'Nexus Edu', title: 'Custom report — country-wise conversion', priority: 'Low', status: 'New', type: 'Feature Request', created: '5d ago' },
  { id: 'T-2037', tenant: 'Horizon Academy', title: 'Invoice for August not received', priority: 'Medium', status: 'Completed', type: 'Billing Support', created: '6d ago' },
];

export const REVENUE_CHART = [
  { m: 'Jan', potential: 380000, received: 210000 }, { m: 'Feb', potential: 420000, received: 260000 },
  { m: 'Mar', potential: 510000, received: 340000 }, { m: 'Apr', potential: 480000, received: 320000 },
  { m: 'May', potential: 620000, received: 410000 }, { m: 'Jun', potential: 710000, received: 520000 },
  { m: 'Jul', potential: 890000, received: 640000 }, { m: 'Aug', potential: 950000, received: 720000 },
];

export const LEAD_SOURCE_DATA = [
  { name: 'Google Form', v: 2840, color: '#6366f1' },
  { name: 'Website Form', v: 1920, color: '#10b981' },
  { name: 'IM Leads', v: 1610, color: '#f59e0b' },
  { name: 'DM Leads', v: 1240, color: '#ec4899' },
  { name: 'Walk-ins', v: 480, color: '#8b5cf6' },
  { name: 'Referrals', v: 330, color: '#14b8a6' },
];

export const MRR_TREND = [
  { m: 'Feb', mrr: 12500 }, { m: 'Mar', mrr: 15000 }, { m: 'Apr', mrr: 15000 },
  { m: 'May', mrr: 17500 }, { m: 'Jun', mrr: 20000 }, { m: 'Jul', mrr: 20000 }, { m: 'Aug', mrr: 20000 },
];
