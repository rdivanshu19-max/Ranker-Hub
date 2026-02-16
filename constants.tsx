
import React from 'react';
import { Material } from './types';

export const ADMIN_PASSCODE = '2009';

export const CATEGORIES = ['PDF', 'Lecture', 'Note', 'Test', 'Video'] as const;

export const SYLLABUS = {
  JEE: {
    Physics: {
      "Class 11": ["Units & Measurements", "Kinematics", "Laws of Motion", "Work, Energy & Power", "Rotational Motion", "Gravitation", "Thermodynamics", "Oscillations & Waves"],
      "Class 12": ["Electrostatics", "Current Electricity", "Magnetism", "Electromagnetic Induction", "Optics", "Modern Physics", "Semiconductors"]
    },
    Chemistry: {
      "Class 11": ["Basic Concepts", "Structure of Atom", "Classification of Elements", "Chemical Bonding", "States of Matter", "Equilibrium", "Redox Reactions", "Organic Chemistry Basics"],
      "Class 12": ["Solid State", "Solutions", "Electrochemistry", "Chemical Kinetics", "Surface Chemistry", "Coordination Compounds", "Biomolecules", "Polymers"]
    },
    Mathematics: {
      "Class 11": ["Sets & Functions", "Trigonometry", "Algebra", "Coordinate Geometry", "Calculus (Limits)", "Statistics & Probability"],
      "Class 12": ["Relations & Functions", "Algebra (Matrices)", "Calculus (Integration)", "Vectors & 3D Geometry", "Linear Programming", "Probability"]
    }
  },
  NEET: {
    Physics: {
      "Class 11": ["Physical World", "Kinematics", "Laws of Motion", "Properties of Bulk Matter", "Thermodynamics", "Behavior of Perfect Gas"],
      "Class 12": ["Electrostatics", "Current Electricity", "Magnetic Effects of Current", "Electromagnetic Waves", "Dual Nature of Matter", "Atoms & Nuclei"]
    },
    Chemistry: {
      "Class 11": ["Some Basic Concepts", "Atomic Structure", "Periodicity", "Chemical Bonding", "States of Matter", "Thermodynamics", "Hydrocarbons"],
      "Class 12": ["Solid State", "Solutions", "Electrochemistry", "Chemical Kinetics", "p-Block Elements", "d & f Block Elements", "Organic Compounds"]
    },
    Biology: {
      "Class 11": ["Diversity in Living World", "Structural Organisation", "Cell Structure & Function", "Plant Physiology", "Human Physiology"],
      "Class 12": ["Reproduction", "Genetics & Evolution", "Biology & Human Welfare", "Biotechnology", "Ecology & Environment"]
    }
  }
} as const;

export const INITIAL_MATERIALS: Material[] = [
  { 
    id: '1', 
    title: 'Calculus I - Integration Techniques', 
    description: 'Advanced techniques for single variable calculus focusing on integration by parts and partial fractions.', 
    category: 'Note', 
    fileName: 'calc1.pdf', 
    uploadDate: '2023-10-01', 
    downloads: 124,
    ratings: [],
    comments: [],
    reports: 0
  },
  { 
    id: '2', 
    title: 'Biology: Cellular Mitosis', 
    description: 'Visual guide to the stages of mitosis and cellular division in eukaryotes.', 
    category: 'Lecture', 
    fileName: 'mitosis.mp4', 
    uploadDate: '2023-10-05', 
    downloads: 89,
    ratings: [],
    comments: [],
    reports: 0
  },
  { 
    id: '3', 
    title: 'Organic Chemistry Mock Final', 
    description: 'Comprehensive practice exam for chemistry students covering nomenclature and reaction mechanisms.', 
    category: 'Test', 
    fileName: 'chem_test.pdf', 
    uploadDate: '2023-11-12', 
    downloads: 256,
    ratings: [],
    comments: [],
    reports: 0
  },
  { 
    id: '4', 
    title: 'Introduction to Quantum Physics', 
    description: 'Full lecture video explaining the foundations of quantum mechanics, wave-particle duality, and the uncertainty principle.', 
    category: 'Video', 
    fileName: 'quantum_intro.mp4', 
    uploadDate: '2024-01-15', 
    downloads: 412,
    ratings: [],
    comments: [],
    reports: 0
  }
];

export const LEGAL_PAGES = {
  terms: {
    title: "Terms and Conditions",
    content: `Welcome to RANKER STUDY SPACE. By accessing our platform, you agree to these terms.
    1. Usage: This platform is for educational purposes only.
    2. Copyright: All materials provided remain the property of their respective owners.
    3. Conduct: Users must not engage in harassment or distribute prohibited content.
    4. Data Usage: We use your data to provide and improve our educational services.
    5. Termination: Accounts violating community rules may be warned, muted, or banned.
    Ranker Study Space provides these services "as is" without any explicit warranty.`
  },
  privacy: {
    title: "Privacy Policy",
    content: `We value your privacy. 
    1. Data Collection: We collect email addresses and basic profile information for account management.
    2. Usage: Your activity data helps us generate performance metrics.
    3. Cookies: We use cookies to maintain your login session.
    4. Sharing: We do not sell your personal data to third parties.
    5. Compliance: Our policy is designed to be compliant with major global standards.`
  },
  disclaimer: {
    title: "Disclaimer",
    content: `Ranker Study Space is a community-driven educational platform.
    1. Accuracy: While we strive for quality, we do not guarantee the accuracy of community-uploaded materials.
    2. Liability: We are not responsible for academic failure or any losses incurred through site usage.
    3. External Links: We are not responsible for the content of external websites linked from our platform.
    4. AdSense: This site may display advertisements which are governed by the Google AdSense Privacy Policy.`
  }
};
