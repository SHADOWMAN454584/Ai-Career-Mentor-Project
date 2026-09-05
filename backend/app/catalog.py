ROLES = {
    "Machine Learning Engineer": ["python", "machine learning", "statistics", "sql", "pandas", "scikit-learn", "deep learning", "git"],
    "Data Scientist": ["python", "statistics", "sql", "pandas", "machine learning", "data visualization", "git"],
    "Data Analyst": ["sql", "excel", "python", "pandas", "data visualization", "statistics", "power bi"],
    "Backend Developer": ["python", "fastapi", "sql", "postgresql", "rest api", "docker", "git"],
    "Software Development Engineer": ["python", "data structures", "algorithms", "git", "sql", "object oriented programming"],
    "Frontend Developer": ["javascript", "react", "html", "css", "typescript", "git"],
    "DevOps Engineer": ["linux", "docker", "kubernetes", "ci/cd", "cloud", "git"],
    "Business Analyst": ["sql", "excel", "data visualization", "communication", "statistics", "power bi"],
    "AI Engineer": ["python", "machine learning", "deep learning", "llm", "fastapi", "docker", "git"],
    "Cloud Engineer": ["linux", "cloud", "docker", "networking", "python", "ci/cd"],
}

ALIASES = {
    "ml": "machine learning", "sklearn": "scikit-learn", "scikit learn": "scikit-learn",
    "postgres": "postgresql", "rest": "rest api", "api": "rest api", "js": "javascript",
    "powerbi": "power bi", "nlp": "machine learning", "aws": "cloud", "gcp": "cloud",
}

PREREQUISITES = {
    "python": [], "sql": [], "statistics": [], "git": [], "excel": [], "html": [], "css": [],
    "pandas": ["python"], "scikit-learn": ["python", "statistics", "pandas"],
    "machine learning": ["python", "statistics", "pandas"], "deep learning": ["machine learning"],
    "fastapi": ["python", "rest api"], "postgresql": ["sql"], "react": ["javascript", "html", "css"],
    "typescript": ["javascript"], "docker": ["linux"], "kubernetes": ["docker"], "llm": ["python"],
}

COURSES = [
    {"skill": "python", "name": "Python for Everybody", "platform": "Coursera", "link": "https://www.coursera.org/specializations/python"},
    {"skill": "sql", "name": "SQLBolt Interactive Lessons", "platform": "SQLBolt", "link": "https://sqlbolt.com/"},
    {"skill": "statistics", "name": "Introduction to Statistics", "platform": "Khan Academy", "link": "https://www.khanacademy.org/math/statistics-probability"},
    {"skill": "machine learning", "name": "Machine Learning Specialization", "platform": "Coursera", "link": "https://www.coursera.org/specializations/machine-learning-introduction"},
    {"skill": "scikit-learn", "name": "scikit-learn MOOC", "platform": "INRIA", "link": "https://inria.github.io/scikit-learn-mooc/"},
    {"skill": "pandas", "name": "Pandas Tutorials", "platform": "Kaggle", "link": "https://www.kaggle.com/learn/pandas"},
    {"skill": "data visualization", "name": "Data Visualization", "platform": "Kaggle", "link": "https://www.kaggle.com/learn/data-visualization"},
    {"skill": "fastapi", "name": "FastAPI Tutorial", "platform": "FastAPI", "link": "https://fastapi.tiangolo.com/tutorial/"},
    {"skill": "react", "name": "Learn React", "platform": "React", "link": "https://react.dev/learn"},
    {"skill": "docker", "name": "Docker Get Started", "platform": "Docker", "link": "https://docs.docker.com/get-started/"},
    {"skill": "data structures", "name": "Data Structures and Algorithms", "platform": "Coursera", "link": "https://www.coursera.org/specializations/data-structures-algorithms"},
    {"skill": "linux", "name": "Linux Journey", "platform": "Linux Journey", "link": "https://linuxjourney.com/"},
]

