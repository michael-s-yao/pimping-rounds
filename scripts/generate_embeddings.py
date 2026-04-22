#!/usr/bin/python3
"""
Medical term embeddings generator.

Author(s):
    Michael Yao @michael-s-yao

Licensed under the MIT License. Copyright Michael Yao 2026.
"""
import base64
import numpy as np
import json
from pathlib import Path
from sentence_transformers import SentenceTransformer
from typing import Dict, List, Tuple, Union


def load_medical_terms(
    datapath: Union[Path, str]
) -> Dict[str, Union[str, List[str]]]:
    """
    Loads the medical terms from the specified input file path.
    Input:
        datapath: the input file path.
    Returns:
        The loaded medical terms.
    """
    with open(str(datapath)) as f:
        return json.load(f)


def generate_embeddings(
    data: Dict[str, Union[str, List[str]]],
    embedding_model: str = "NeuML/pubmedbert-base-embeddings"
) -> Tuple[np.ndarray, str]:
    """
    Generate the model embeddings for each term in the dataset.
    Input:
        data: the input data to generate the embeddings for.
        embedding_model: the embedding model to use.
    Returns:
        A tuple of the generated embeddings of size NxD, where N is the number
        of terms in the dataset and D is the embedding dimension, and the name
        of the embedding model that was used.
    """
    model = SentenceTransformer(embedding_model)
    embeddings: np.ndarray = model.encode(
        [x["term"] for x in data],
        batch_size=64,
        show_progress_bar=True,
        normalize_embeddings=True,
        convert_to_numpy=True,
    )
    return embeddings.astype(np.float32), embedding_model


def save_embeddings(
    savepath: Union[Path, str],
    embeddings: np.ndarray,
    embedding_model: str
) -> None:
    """
    Saves the model embeddings for the terms to local memory.
    Input:
        data: the input data to generate the embeddings for.
        savepath: the path to save the model embeddings to in local memory.
        embeddings: the generated embeddings of size NxD, where N is the
            number of terms in the dataset and D is the embedding dimension.
        embedding_model: the name of the embedding model that was used.
    Returns:
        None.
        of the embedding model that was used.
    """
    b64_str = base64.b64encode(embeddings.tobytes()).decode("ascii")
    n, dim = embeddings.shape
    payload = {
        "n": n,
        "dim": dim,
        "dtype": "float32",
        "normalized": True,
        "embedding_model": embedding_model,
        "embeddings": b64_str
    }

    with open(str(savepath), "w") as f:
        json.dump(payload, f, separators=(",", ":"))


if __name__ == "__main__":
    datapath = "terms.json"
    savepath = "embeddings.json"
    terms = load_medical_terms(datapath)
    embedding_model = "NeuML/pubmedbert-base-embeddings"
    save_embeddings(savepath, *generate_embeddings(terms, embedding_model))
