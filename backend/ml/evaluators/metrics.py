from __future__ import annotations

import math


def compute_classification_metrics(y_true: list[int], y_score: list[float], threshold: float = 0.5) -> dict[str, float | int]:
    if len(y_true) != len(y_score):
        raise ValueError("y_true and y_score must have the same length")
    if not y_true:
        raise ValueError("At least one label is required")

    y_pred = [1 if score >= threshold else 0 for score in y_score]

    tp = sum(1 for truth, pred in zip(y_true, y_pred) if truth == 1 and pred == 1)
    tn = sum(1 for truth, pred in zip(y_true, y_pred) if truth == 0 and pred == 0)
    fp = sum(1 for truth, pred in zip(y_true, y_pred) if truth == 0 and pred == 1)
    fn = sum(1 for truth, pred in zip(y_true, y_pred) if truth == 1 and pred == 0)

    accuracy = (tp + tn) / len(y_true)
    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    f1_score = (2 * precision * recall / (precision + recall)) if (precision + recall) else 0.0

    return {
        "threshold": round(threshold, 4),
        "accuracy": round(accuracy, 4),
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1_score": round(f1_score, 4),
        "support": len(y_true),
    }


def _dcg(relevances: list[int], k: int) -> float:
    total = 0.0
    for rank, relevance in enumerate(relevances[:k], start=1):
        if relevance <= 0:
            continue
        total += relevance / math.log2(rank + 1)
    return total


def compute_ranking_metrics(queries: list[dict], k: int = 5) -> dict[str, float | int]:
    if not queries:
        raise ValueError("At least one ranking query is required")

    precision_values: list[float] = []
    recall_values: list[float] = []
    reciprocal_ranks: list[float] = []
    average_precisions: list[float] = []
    ndcg_values: list[float] = []

    for query in queries:
        ranked = sorted(query["candidates"], key=lambda item: item["score"], reverse=True)
        top_k = ranked[:k]
        relevant_total = sum(item["relevant"] for item in ranked)
        relevant_in_k = sum(item["relevant"] for item in top_k)

        precision_values.append(relevant_in_k / len(top_k) if top_k else 0.0)
        recall_values.append(relevant_in_k / relevant_total if relevant_total else 0.0)

        reciprocal_rank = 0.0
        hits = 0
        precision_sum = 0.0

        for rank, item in enumerate(ranked[:k], start=1):
            if item["relevant"]:
                if reciprocal_rank == 0.0:
                    reciprocal_rank = 1.0 / rank
                hits += 1
                precision_sum += hits / rank

        reciprocal_ranks.append(reciprocal_rank)
        average_precisions.append(precision_sum / relevant_total if relevant_total else 0.0)

        observed_relevances = [item["relevant"] for item in top_k]
        ideal_relevances = sorted((item["relevant"] for item in ranked), reverse=True)
        ideal_dcg = _dcg(ideal_relevances, k)
        ndcg_values.append(_dcg(observed_relevances, k) / ideal_dcg if ideal_dcg else 0.0)

    return {
        "queries": len(queries),
        "precision_at_k": round(sum(precision_values) / len(precision_values), 4),
        "recall_at_k": round(sum(recall_values) / len(recall_values), 4),
        "mean_reciprocal_rank": round(sum(reciprocal_ranks) / len(reciprocal_ranks), 4),
        "mean_average_precision_at_k": round(sum(average_precisions) / len(average_precisions), 4),
        "ndcg_at_k": round(sum(ndcg_values) / len(ndcg_values), 4),
    }
