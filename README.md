# EduExplain: Student Performance Prediction with XAI

This repository hosts a machine learning-based system designed to predict student academic outcomes while providing human-readable explanations for those predictions. This work was developed as a **Third-Year Mini Project at GRIET**.

The development process utilized **Google AI Studio** as the primary environment for coding and integration. While the core machine learning logic was authored in Python, the transition to a functional web platform was achieved through TypeScript, with AI Studio facilitating the integration of the backend model with the frontend interface.

---
EduExplain: Student Performance Prediction with XAI
This repository hosts a machine learning-based system designed to predict student academic outcomes while providing human-readable explanations for those predictions. This work was developed as a Third-Year Mini Project at GRIET.

The development process utilized Google AI Studio as the primary environment for coding and integration. While the core machine learning logic was authored in Python, the transition to a functional web platform was achieved through TypeScript, with AI Studio facilitating the integration of the backend model with the frontend interface.

### 🌟 Key Features
The platform is designed with two distinct interfaces to support both educators and learners:

#### User 1: Faculty Portal
* **Predictions & Reasoning**: Generate student performance forecasts with integrated XAI to understand the underlying academic drivers and provide recommendations for enhancing the grade

* **Quesiton Crafter**: An AI-powered chatbot to automatically create relevant questions for quizzes and student assessments.

* **Timetable Tracker**: A dedicated module to manage and track lecture schedules and academic timelines.

#### User 2: Student Portal
* **AI Doubt Resolution**: An interactive chatbot designed to provide real-time assistance and clarify academic concepts.

* **Study Planner**: A comprehensive tracker for organizing study sessions and maintaining personal learning goals.

* **Smart Scheduler**: An reminder system for upcoming exams and assignment due dates to ensure deadlines are never missed.

### 📊 Data Source

The model is trained on educational datasets sourced from the **UCI Machine Learning Repository**. This high-quality, peer-reviewed data provides a variety of features, including student demographics, social background, and previous academic records, which are essential for building a reliable predictive system.

### 🏗️ Project Architecture

The system employs a dual-model approach to provide a comprehensive look at student data:

1. **Classification (Random Forest):** Predicts categorical outcomes, such as whether a student is likely to pass, fail, or excel.
2. **Regression:** Estimates specific numerical scores to gauge the degree of expected performance.

### 🛠️ Core Components

* **Model Training:** Developed in **Python**, utilizing Scikit-learn for the Random Forest and Regression algorithms.
* **Explainable AI (XAI):** Integrated SHAP and LIME frameworks to transform the "black-box" model into a transparent system, identifying exactly which factors (e.g., attendance, assignment scores) influenced a prediction.
* **Web Integration:** The frontend and model-to-site communication were built using **TypeScript**. **Google AI Studio** was used to assist in writing the integration logic and bridging the gap between the Python scripts and the web environment.

### 💻 Tech Stack

* **Languages:** Python (ML Core), TypeScript (Web Integration)
* **Development Environment:** Google AI Studio
* **Algorithms:** Random Forest Classifier, Regression
* **XAI Frameworks:** SHAP, LIME
* **Data Source:** UCI Machine Learning Repository

### 🔍 Implementation Details

The project emphasizes **Model Interpretability**. By using XAI, the system doesn't just provide a score; it generates visualizations that show the positive or negative impact of various student metrics. This allows educators to understand the underlying causes of a prediction and intervene effectively.
