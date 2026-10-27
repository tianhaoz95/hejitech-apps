package com.hejitech.weehours.core

import kotlin.math.exp
import kotlin.math.max
import kotlin.math.min

object LayaPrompt {
    const val choiceColumn = 0

    fun render(state: String, question: DecisionQuestion): String {
        fun clean(s: String): String = s.replace("[MASK]", " ")
        val sb = StringBuilder()
        sb.append("[CLS]choice question: ").append(clean(question.instructions)).append("[SEP]")
        for (o in question.options) {
            sb.append("[MASK] ").append(clean(o.key))
            val d = o.description
            if (!d.isNullOrEmpty()) {
                sb.append(": ").append(clean(d))
            }
        }
        sb.append("[SEP]").append(clean(state)).append("[SEP]")
        return sb.toString()
    }

    data class Layout(
        val tokens: List<Int>,
        val markers: List<Int>
    )

    class LayoutError : Exception("Unexpected token layout")

    fun layout(
        tokens: List<Int>,
        mask: Int,
        sep: Int,
        nOptions: Int,
        maxHeadTokens: Int,
        maxOptionTokens: Int = 48
    ): Layout {
        val markers = tokens.indices.filter { tokens[it] == mask }
        if (markers.size != nOptions || markers[0] < 2 || tokens[markers[0] - 1] != sep || tokens.lastOrNull() != sep) {
            throw LayoutError()
        }
        val headEnd = markers[0] - 1
        val lastMarker = markers.last()
        val optsEndOffset = tokens.subList(lastMarker, tokens.size).indexOfFirst { it == sep }
        if (optsEndOffset < 0) throw LayoutError()
        val optsEnd = lastMarker + optsEndOffset
        if (optsEnd + 1 >= tokens.size) throw LayoutError()

        val options = MutableList(nOptions) { i ->
            val end = if (i + 1 < nOptions) markers[i + 1] else optsEnd
            tokens.subList(markers[i], end).toList()
        }

        fun setMax(n: Int): Int {
            var total = 0
            for (i in options.indices) {
                if (options[i].size > n) {
                    options[i] = options[i].take(n)
                }
                total += options[i].size
            }
            return total
        }

        var nOptionTokens = setMax(maxOptionTokens + 1)
        if (nOptionTokens + 16 > maxHeadTokens) {
            nOptionTokens = setMax(max(4, (maxHeadTokens - min(maxHeadTokens, 16)) / nOptions))
        }
        val nQuestionMax = max(8, maxHeadTokens - min(maxHeadTokens, nOptionTokens))

        val out = mutableListOf(tokens[0])
        out.addAll(tokens.subList(1, min(headEnd, 1 + nQuestionMax)))
        out.add(sep)
        val outMarkers = mutableListOf<Int>()
        for (o in options) {
            outMarkers.add(out.size)
            out.addAll(o)
        }
        out.addAll(tokens.subList(optsEnd, tokens.size))
        return Layout(tokens = out, markers = outMarkers)
    }

    fun temperatureKey(options: Int): String {
        val bucket = when {
            options <= 2 -> "2"
            options <= 5 -> "3_5"
            options <= 10 -> "6_10"
            else -> "11"
        }
        return "choice.$bucket"
    }

    fun probabilities(scores: List<Float>, temperature: Double): List<Double> {
        val logits = scores.map { it.toDouble() }
        val m = logits.maxOrNull() ?: 0.0
        val ex = logits.map { exp((it - m) / temperature) }
        val s = ex.sum()
        return ex.map { it / s }
    }
}
