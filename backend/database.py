import os
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket
from beanie import init_beanie
from dotenv import load_dotenv

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017/trialos")
DATABASE_NAME = os.getenv("DATABASE_NAME", "trialos")

client: AsyncIOMotorClient = None
db = None
gridfs_bucket: AsyncIOMotorGridFSBucket = None


async def connect_db(document_models: list):
    global client, db, gridfs_bucket
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    gridfs_bucket = AsyncIOMotorGridFSBucket(db, bucket_name="files")
    await init_beanie(database=db, document_models=document_models)


async def close_db():
    if client:
        client.close()


def get_gridfs() -> AsyncIOMotorGridFSBucket:
    return gridfs_bucket
